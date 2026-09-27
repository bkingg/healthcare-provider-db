"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ListPlus, Lock, Send, X } from "lucide-react";
import type { ActionResult } from "@/lib/validation/common";
import { mentionQueryAt } from "@/lib/mentions";
import { addNoteAction, messageMemberAction } from "../actions";
import { ActionFields } from "./action-fields";
import type { Worker } from "./assignee-picker";

const ACTION_FIELDS = ["actionTitle", "actionOwnerId", "actionDue"];

/** The writing box at the bottom of each panel on the case page — one for
 * the conversation with the member, a separate one for internal notes. Each
 * panel has its own box and button, so there's no mode to switch and a note
 * can't be sent to a member by mistake. In the notes box, typing "@" suggests
 * case workers to mention, and a next action can be added with the note. */
export type NoteTemplateOption = { id: string; name: string; body: string };

export function WriteBox({
  variant,
  caseId,
  memberName,
  memberLanguage,
  templates = [],
  workers = [],
  meId = "",
  defaultOwnerId = null,
}: {
  variant: "message" | "note";
  caseId: string;
  memberName: string;
  memberLanguage: string;
  /** Note templates (notes only), already in the staff screen's language. */
  templates?: NoteTemplateOption[];
  /** Notes only: who can be mentioned or given the action. */
  workers?: Worker[];
  meId?: string;
  defaultOwnerId?: string | null;
}) {
  const t = useTranslations("Cases");
  const isMessage = variant === "message";
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");
  // A template picked while the box already has text waits for a
  // "Replace / Keep my text" answer rather than silently wiping it.
  const [pendingTemplate, setPendingTemplate] = useState<NoteTemplateOption | null>(null);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((x) => x.id === id);
    if (!template?.body) return;
    if (text.trim() && text !== template.body) setPendingTemplate(template);
    else setText(template.body);
  }
  // @mention suggestions: what's typed after "@" at the caret.
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionActive, setMentionActive] = useState(0);
  const mentionMatches =
    !isMessage && mention
      ? workers.filter((w) => w.handle.startsWith(mention.query) || (w.name ?? "").toLowerCase().split(/\s+/).some((part) => part.startsWith(mention.query))).slice(0, 6)
      : [];
  const trackMention = (el: HTMLTextAreaElement) => {
    if (isMessage) return;
    const next = el.selectionStart === el.selectionEnd ? mentionQueryAt(el.value, el.selectionStart) : null;
    setMention(next);
    if (next?.query !== mention?.query) setMentionActive(0);
  };
  function insertMention(handle: string) {
    const el = boxRef.current;
    if (!el || !mention) return;
    const caret = el.selectionStart;
    const next = `${text.slice(0, mention.start)}@${handle} ${text.slice(caret)}`;
    const at = mention.start + handle.length + 2;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  // "Add a next action" with this note.
  const [withAction, setWithAction] = useState(false);
  const [actionKey, setActionKey] = useState(0);

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(isMessage ? messageMemberAction : addNoteAction, null);

  // Clear the box once the server has saved it (adjusted during render, no effect).
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.success) {
      setText("");
      setTemplateId("");
      setPendingTemplate(null);
      setWithAction(false);
      setActionKey((k) => k + 1);
    }
  }
  const errors = state && !state.success ? state.errors : {};
  const formError = Object.entries(errors).find(([k]) => !ACTION_FIELDS.includes(k))?.[1]?.[0];

  const id = `${variant}-box`;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      {!isMessage && templates.length > 0 && (
        <>
          <label className="flex flex-col gap-1 text-[10.5px] font-semibold tracking-[0.06em] text-[#92400e] uppercase">
            {t("noteType")}
            <select
              name="templateId"
              value={templateId}
              onChange={(e) => chooseTemplate(e.target.value)}
              className="h-8 border-2 border-[#e8c98a] bg-white px-2 text-[13px] font-normal tracking-normal text-pn-ink normal-case outline-none focus:border-[#b45309]"
            >
              <option value="">{t("generalNote")}</option>
              {templates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {pendingTemplate && (
            <div role="alert" className="flex flex-wrap items-center gap-2 border-l-4 border-[#b45309] bg-white px-2 py-1.5 text-[12px]">
              <span className="flex-1">{t("replaceTemplateQuestion", { name: pendingTemplate.name })}</span>
              <button
                type="button"
                onClick={() => {
                  setText(pendingTemplate.body);
                  setPendingTemplate(null);
                }}
                className="cursor-pointer bg-[#b45309] px-2 py-0.5 font-semibold text-white"
              >
                {t("replaceText")}
              </button>
              <button type="button" onClick={() => setPendingTemplate(null)} className="cursor-pointer border border-[#b45309] px-2 py-0.5 font-semibold text-[#92400e]">
                {t("keepText")}
              </button>
            </div>
          )}
        </>
      )}
      <label htmlFor={id} className="sr-only">
        {isMessage ? t("messagePlaceholder", { name: memberName }) : t("notePlaceholder")}
      </label>
      <div className="relative flex flex-col">
        <textarea
          ref={boxRef}
          id={id}
          name="body"
          role={isMessage ? undefined : "combobox"}
          aria-expanded={isMessage ? undefined : mentionMatches.length > 0}
          aria-controls={isMessage ? undefined : `${id}-mentions`}
          aria-autocomplete={isMessage ? undefined : "list"}
          // Taller once a template has filled it, so its sections are visible.
          rows={!isMessage && templateId ? 12 : 3}
          required
          maxLength={4000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            trackMention(e.target);
          }}
          onClick={(e) => trackMention(e.currentTarget)}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) trackMention(e.currentTarget);
          }}
          onBlur={() => setMention(null)}
          onKeyDown={(e) => {
            if (!mentionMatches.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMentionActive((a) => Math.min(a + 1, mentionMatches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMentionActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insertMention(mentionMatches[Math.min(mentionActive, mentionMatches.length - 1)].handle);
            } else if (e.key === "Escape") {
              setMention(null);
            }
          }}
          placeholder={isMessage ? t("messagePlaceholder", { name: memberName }) : t("notePlaceholder")}
          // Spell-checked in the language it's written in: messages in the
          // member's language, notes in the staff screen's.
          spellCheck
          lang={isMessage ? memberLanguage : undefined}
          autoCapitalize="sentences"
          className={`border-2 bg-white p-2 text-[13.5px] outline-none ${isMessage ? "border-pn-border-muted focus:border-pn-ink" : "border-[#e8c98a] focus:border-[#b45309]"}`}
        />
        {mentionMatches.length > 0 && (
          <ul id={`${id}-mentions`} role="listbox" aria-label={t("mentionSomeone")} className="absolute top-full left-0 z-20 mt-0.5 w-[300px] border-2 border-[#b45309] bg-white py-0.5 shadow-md">
            {mentionMatches.map((w, i) => (
              <li
                key={w.id}
                role="option"
                aria-selected={i === mentionActive}
                onMouseDown={(e) => {
                  // Before the box's blur closes the list.
                  e.preventDefault();
                  insertMention(w.handle);
                }}
                onMouseEnter={() => setMentionActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-2 px-2 py-1.5 text-[12.5px] ${i === mentionActive ? "bg-[#fcefd9]" : ""}`}
              >
                <span className="truncate">
                  {w.name ?? w.email}
                  {w.id === meId ? ` (${t("me")})` : ""}
                </span>
                <span className="flex-none text-[11.5px] font-semibold text-[#92400e]">@{w.handle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!isMessage && workers.length > 0 && (
        withAction ? (
          <div className="flex flex-col gap-2 border-l-4 border-[#b45309] bg-white p-2">
            <input type="hidden" name="withAction" value="1" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.06em] text-[#92400e] uppercase">{t("actionWithNote")}</span>
              <button type="button" onClick={() => setWithAction(false)} aria-label={t("actionRemoveFromNote")} className="cursor-pointer text-pn-gray-2 hover:text-pn-ink">
                <X size={14} aria-hidden />
              </button>
            </div>
            <ActionFields key={actionKey} workers={workers} meId={meId} defaultOwnerId={defaultOwnerId} errors={errors} tone="note" />
          </div>
        ) : (
          <button type="button" onClick={() => setWithAction(true)} className="flex cursor-pointer items-center gap-1 self-start text-[12px] font-semibold text-[#92400e] hover:underline">
            <ListPlus size={13} aria-hidden /> {t("actionAddWithNote")}
          </button>
        )
      )}
      {formError && <p className="m-0 text-[12px] text-[#b91c1c]">{formError}</p>}
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className={`flex h-8 cursor-pointer items-center gap-1.5 self-start px-3 text-xs font-semibold text-white disabled:opacity-40 ${
          isMessage ? "bg-pn-accent hover:bg-pn-accent-hover" : "bg-[#b45309] hover:bg-[#92400e]"
        }`}
      >
        {isMessage ? <Send size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
        {pending ? t("saving") : isMessage ? t("sendToMember", { name: memberName }) : withAction ? t("saveNoteAndAction") : t("saveNote")}
      </button>
    </form>
  );
}
