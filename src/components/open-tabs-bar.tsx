"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useOpenTabs } from "@/lib/open-tabs-context";

/** Open-provider tabs, rendered next to the header search box. Each tab
 * jumps back to that provider's record; its × closes just that one. Hidden
 * entirely when nothing's open, so it never competes with the search box
 * for space on a fresh session. */
export function OpenTabsBar() {
  const t = useTranslations("Header");
  const { tabs, closeTab, closeAllTabs } = useOpenTabs();
  const pathname = usePathname();

  if (tabs.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-none items-center gap-1.5 overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname === `/providers/${tab.id}`;
        return (
          <div
            key={tab.id}
            className={`flex flex-none items-center gap-1.5 border-2 py-1 pl-2.5 pr-1.5 text-[11.5px] whitespace-nowrap ${
              active ? "border-pn-accent text-white" : "border-pn-gray-2 text-pn-gray-4"
            }`}
          >
            <Link href={`/providers/${tab.id}`} className="max-w-[140px] truncate hover:underline">
              {tab.name}
            </Link>
            <button
              type="button"
              onClick={() => closeTab(tab.id)}
              aria-label={t("closeTab", { name: tab.name })}
              className="cursor-pointer text-pn-gray-4 hover:text-white"
            >
              <X size={11} strokeWidth={2} />
            </button>
          </div>
        );
      })}
      {tabs.length > 1 && (
        <button
          type="button"
          onClick={closeAllTabs}
          className="flex-none cursor-pointer text-[11px] whitespace-nowrap text-pn-gray-4 underline hover:text-white"
        >
          {t("closeAllTabs")}
        </button>
      )}
    </div>
  );
}
