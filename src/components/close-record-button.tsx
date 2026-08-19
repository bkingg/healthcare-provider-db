"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useOpenTabs } from "@/lib/open-tabs-context";

/** Top-right "close" for whichever provider record is currently on screen —
 * only rendered while viewing one (`/providers/[id]`, excluding the `new`
 * wizard). Routes through the same closeTab as a tab's own × so the tab
 * strip and this button never disagree about what's open. */
export function CloseRecordButton() {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const { closeTab } = useOpenTabs();

  const match = pathname.match(/^\/providers\/([^/]+)$/);
  if (!match || match[1] === "new") return null;
  const id = match[1];

  return (
    <button
      type="button"
      onClick={() => closeTab(id)}
      aria-label={t("closeRecord")}
      className="flex h-[26px] flex-none cursor-pointer items-center gap-1 border-2 border-pn-gray-2 px-2 text-[11px] font-semibold whitespace-nowrap text-pn-gray-4 hover:border-white hover:text-white"
    >
      <X size={13} strokeWidth={2} /> {t("closeRecord")}
    </button>
  );
}
