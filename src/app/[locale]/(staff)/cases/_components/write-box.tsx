"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Send } from "lucide-react";
import type { ActionResult } from "@/lib/validation/common";
import { addNoteAction, messageMemberAction } from "../actions";

/** The writing box at the bottom of each panel on the case page — one for
 * the conversation with the member, a separate one for internal notes. Each
 * panel has its own box and button, so there's no mode to switch and a note
 * can't be sent to a member by mistake. */
export type NoteTemplateOption = { id: string; name: string; body: string };

export function WriteBox({
  variant,
  caseId,
  memberName,
  memberLanguage,
  templates = [],
}: {
  variant: "message" | "note";
  caseId: string;
  memberName: string;
  memberLanguage: string;
  /** Note templates (notes only), already in the staff screen's language. */
  templates?: NoteTemplateOption[];
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
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(isMessage ? messageMemberAction : addNoteAction, null);

  // Clear the box once the server has saved it (adjusted during render, no effect).
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.success) {
      setText("");
      setTemplateId("");
      setPendingTemplate(null);
    }
  }

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
      <textarea
        id={id}
        name="body"
        // Taller once a template has filled it, so its sections are visible.
        rows={!isMessage && templateId ? 12 : 3}
        required
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isMessage ? t("messagePlaceholder", { name: memberName }) : t("notePlaceholder")}
        // Spell-checked in the language it's written in: messages in the
        // member's language, notes in the staff screen's.
        spellCheck
        lang={isMessage ? memberLanguage : undefined}
        autoCapitalize="sentences"
        className={`border-2 bg-white p-2 text-[13.5px] outline-none ${isMessage ? "border-pn-border-muted focus:border-pn-ink" : "border-[#e8c98a] focus:border-[#b45309]"}`}
      />
      {state && !state.success && <p className="m-0 text-[12px] text-[#b91c1c]">{Object.values(state.errors)[0]?.[0]}</p>}
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className={`flex h-8 cursor-pointer items-center gap-1.5 self-start px-3 text-xs font-semibold text-white disabled:opacity-40 ${
          isMessage ? "bg-pn-accent hover:bg-pn-accent-hover" : "bg-[#b45309] hover:bg-[#92400e]"
        }`}
      >
        {isMessage ? <Send size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
        {pending ? t("saving") : isMessage ? t("sendToMember", { name: memberName }) : t("saveNote")}
      </button>
    </form>
  );
}
