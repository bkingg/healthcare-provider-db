"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Send } from "lucide-react";
import type { ActionResult } from "@/lib/validation/common";
import { addNoteAction, messageMemberAction } from "../actions";

/** One box, two kinds of writing: a message the member sees in the app, or
 * an internal note staff only. Clearly labelled so a note is never sent to
 * a member by mistake. */
export function CaseComposer({ caseId, memberName, memberLanguage }: { caseId: string; memberName: string; memberLanguage: string }) {
  const t = useTranslations("Cases");
  const [mode, setMode] = useState<"message" | "note">("message");
  const [text, setText] = useState("");
  const [msgState, sendMessage, sendingMessage] = useActionState<ActionResult | null, FormData>(messageMemberAction, null);
  const [noteState, saveNote, savingNote] = useActionState<ActionResult | null, FormData>(addNoteAction, null);

  // Clear the box once the server has saved it (adjusted during render, no effect).
  const [seen, setSeen] = useState<[ActionResult | null, ActionResult | null]>([msgState, noteState]);
  if (seen[0] !== msgState || seen[1] !== noteState) {
    setSeen([msgState, noteState]);
    if ((seen[0] !== msgState && msgState?.success) || (seen[1] !== noteState && noteState?.success)) setText("");
  }

  const pending = sendingMessage || savingNote;
  const state = mode === "message" ? msgState : noteState;
  const isMessage = mode === "message";

  return (
    <form action={isMessage ? sendMessage : saveNote} className={`flex flex-col gap-2 border-2 p-3 ${isMessage ? "border-pn-ink bg-white" : "border-[#b45309] bg-[#fffaf0]"}`}>
      <input type="hidden" name="caseId" value={caseId} />
      <div role="tablist" className="flex gap-1">
        {(["message", "note"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex cursor-pointer items-center gap-1.5 px-3 py-1 text-[12px] font-semibold ${mode === m ? "bg-pn-ink text-white" : "text-pn-gray-1 hover:bg-pn-surface-hover"}`}
          >
            {m === "message" ? <Send size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
            {m === "message" ? t("tabMessage") : t("tabNote")}
          </button>
        ))}
      </div>
      <p className="m-0 text-[12px] text-pn-gray-2">{isMessage ? t("messageHint", { name: memberName }) : t("noteHint")}</p>
      <label htmlFor="composer" className="sr-only">
        {isMessage ? t("tabMessage") : t("tabNote")}
      </label>
      <textarea
        id="composer"
        name="body"
        rows={3}
        required
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Spell-checked in the language it's written in: messages in the
        // member's language, notes in the staff screen's.
        spellCheck
        lang={isMessage ? memberLanguage : undefined}
        autoCapitalize="sentences"
        className="border-2 border-pn-border-muted bg-white p-2 text-[13.5px] outline-none focus:border-pn-ink"
      />
      {state && !state.success && <p className="m-0 text-[12px] text-[#b91c1c]">{Object.values(state.errors)[0]?.[0]}</p>}
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className={`h-8 cursor-pointer self-start px-3 text-xs font-semibold text-white disabled:opacity-40 ${isMessage ? "bg-pn-accent hover:bg-pn-accent-hover" : "bg-[#b45309]"}`}
      >
        {pending ? t("saving") : isMessage ? t("sendMessage") : t("saveNote")}
      </button>
    </form>
  );
}
