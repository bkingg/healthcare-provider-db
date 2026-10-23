"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { ResizeHandle } from "@/components/resize-handle";
import { BarChart3, Building2, FilePlus, ListTree, Map as MapIcon, Search, Inbox, Upload, Users, UsersRound, Pill, Sparkles } from "lucide-react";

type WorkspaceItem = {
  href: string;
  label: string;
  icon: typeof Search;
  badge?: string;
  match: (path: string) => boolean;
};

export function SidebarNav({
  latestBatchLabel,
  openExceptionCount,
  canEditValueLists,
  canManageUsers,
  canViewReports,
  canManageMembers,
  canWorkCases,
  casesNeedingAttention,
}: {
  latestBatchLabel: string | null;
  openExceptionCount: number;
  canEditValueLists: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canManageMembers: boolean;
  canWorkCases: boolean;
  casesNeedingAttention: number;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const providerProfileMatch = /^\/providers\/[^/]+$/.test(pathname) && pathname !== "/providers/new";

  const items: WorkspaceItem[] = [
    // First for case workers: the operations dashboard, badged with open
    // red + yellow cases.
    ...(canWorkCases
      ? [{ href: "/cases", label: t("cases"), icon: Inbox, badge: casesNeedingAttention ? String(casesNeedingAttention) : undefined, match: (p: string) => p.startsWith("/cases") }]
      : []),
    { href: "/providers", label: t("providerSearch"), icon: Search, match: (p) => p === "/providers" },
    {
      href: providerProfileMatch ? pathname : "/providers",
      label: t("providerProfile"),
      icon: Building2,
      match: () => providerProfileMatch,
    },
    { href: "/providers/new", label: t("newProvider"), icon: FilePlus, badge: "DRAFT", match: (p) => p === "/providers/new" },
    { href: "/import", label: t("bulkImport"), icon: Upload, badge: openExceptionCount ? String(openExceptionCount) : undefined, match: (p) => p.startsWith("/import") },
    { href: "/map", label: t("geospatialSearch"), icon: MapIcon, match: (p) => p === "/map" },
    ...(canManageMembers ? [{ href: "/members", label: t("members"), icon: UsersRound, match: (p: string) => p.startsWith("/members") }] : []),
  ];

  const adminItems: WorkspaceItem[] = [
    ...(canEditValueLists
      ? [
          {
            href: "/admin",
            label: t("admin"),
            icon: ListTree,
            match: (p: string) => p.startsWith("/admin") && !["/admin/users", "/admin/reports", "/admin/medications", "/admin/copilot"].some((x) => p.startsWith(x)),
          },
          { href: "/admin/medications", label: t("medicationCatalog"), icon: Pill, match: (p: string) => p.startsWith("/admin/medications") },
          { href: "/admin/copilot", label: t("copilot"), icon: Sparkles, match: (p: string) => p.startsWith("/admin/copilot") },
        ]
      : []),
    ...(canManageUsers ? [{ href: "/admin/users", label: t("users"), icon: Users, match: (p: string) => p.startsWith("/admin/users") }] : []),
    ...(canViewReports
      ? [{ href: "/admin/reports", label: t("reports"), icon: BarChart3, match: (p: string) => p.startsWith("/admin/reports") }]
      : []),
  ];

  function renderItem(item: WorkspaceItem) {
    const active = item.match(pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.label}
        href={item.href}
        className={`flex w-full items-center gap-2.5 border-l-4 px-4 max-[1180px]:justify-center max-[1180px]:gap-0 max-[1180px]:px-0 py-2 text-[12.5px] hover:bg-pn-surface-hover ${
          active ? "border-pn-accent bg-pn-surface-hover font-bold" : "border-transparent font-medium"
        }`}
      >
        <Icon size={15} strokeWidth={2} className="flex-none" />
        <span data-r="navtext" className="max-[1180px]:hidden flex-1 text-left">
          {item.label}
        </span>
        {item.badge && (
          <span
            data-r="navtext"
            className={`max-[1180px]:hidden px-[5px] text-[10px] font-bold tracking-[0.04em] ${
              item.badge === "DRAFT" ? "bg-pn-rule text-pn-gray-1" : "bg-pn-accent text-white"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      <nav
        data-r="nav"
        className="flex max-[1180px]:w-16 w-[var(--pn-nav-w,248px)] flex-none flex-col overflow-auto border-r-2 border-pn-ink bg-white"
      >
        <div data-r="navsection" className="max-[1180px]:hidden px-4 pt-3.5 pb-2 text-[10px] tracking-[0.1em] text-pn-gray-3 uppercase">
          {t("workspace")}
        </div>
        {items.map(renderItem)}

        {adminItems.length > 0 && (
          <>
            <div data-r="navsection" className="max-[1180px]:hidden px-4 pt-3.5 pb-2 text-[10px] tracking-[0.1em] text-pn-gray-3 uppercase">
              {t("administration")}
            </div>
            {adminItems.map(renderItem)}
          </>
        )}

        <div
          data-r="navsection"
          className="max-[1180px]:hidden mt-auto border-t-2 border-pn-ink px-4 py-3.5 text-[11px] leading-relaxed text-pn-gray-3"
        >
          {t("lastImportBatch")}
          <br />
          <span className="font-semibold text-pn-ink">{latestBatchLabel ?? t("noBatchYet")}</span>
          <br />
          <span className="font-semibold text-[#0a5c3c]">{t("exceptionsOpen", { count: openExceptionCount })}</span>
        </div>
      </nav>
      {/* Hidden when the nav collapses to its icon strip — that width is fixed. */}
      <ResizeHandle panelKey="nav" measure="previous" label={t("resizeWorkspace")} className="max-[1180px]:hidden" />
    </>
  );
}
