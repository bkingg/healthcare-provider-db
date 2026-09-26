"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/validation/common";
import { memberReplyAction } from "../../../actions";

export function ReplyForm({ caseId }: { caseId: string }) {
  const t = useTranslations("MemberApp");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(memberReplyAction, null);
  // Controlled so a failed send doesn't wipe what the member typed; cleared
  // once the server has saved it (adjusted during render, no effect).
  const [text, setText] = useState("");
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.success) setText("");
  }
  const error = state && !state.success ? (state.errors.body?.[0] ?? state.errors.form?.[0]) : undefined;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <label htmlFor="reply" className="text-[14px] font-semibold">
        {t("replyLabel")}
      </label>
      <textarea
        id="reply"
        name="body"
        rows={3}
        required
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck
        autoCapitalize="sentences"
        autoCorrect="on"
        className="border-2 border-pn-border-muted bg-white p-3 text-[16px] outline-none focus:border-pn-ink"
      />
      {error && <p className="m-0 text-[14px] text-[#b91c1c]">{t(`replyError.${error}`)}</p>}
      <button type="submit" disabled={pending || !text.trim()} className="h-12 cursor-pointer bg-pn-ink text-[16px] font-bold text-white disabled:opacity-40">
        {pending ? t("sending") : t("sendReply")}
      </button>
    </form>
  );
}
