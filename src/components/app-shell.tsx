import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LogOut, KeyRound } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { getCurrentActor } from "@/lib/actor";
import { canEditValueLists, canManageMembers, canManageUsers, canViewReports, canWorkCases } from "@/lib/rbac";
import { attentionCount } from "@/data/caseOps";
import { getLatestImportBatch } from "@/data/importBatches";
import { countOpenExceptions } from "@/data/dataQualityExceptions";
import { Link } from "@/i18n/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { HeaderSearch } from "@/components/header-search";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { OpenTabsBar } from "@/components/open-tabs-bar";
import { CloseRecordButton } from "@/components/close-record-button";
import { PanelWidthsRoot } from "@/components/panel-widths-root";
import { OpenTabsProvider } from "@/lib/open-tabs-context";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/** Initials for the header avatar badge — first letters of up to two
 * words in the actor's name, falling back to the email's first two
 * characters when there's no name on file. */
function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[1][0]] : [source[0], source[1] ?? ""];
  return letters.join("").toUpperCase();
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // No chrome pre-login — this is what makes /login render as a bare,
  // full-page form instead of the app's sidebar/header wrapping an
  // unauthenticated page. Proxy.ts is what actually keeps every other route
  // from being reached without a session; this is just the rendering side
  // of that same fact.
  if (!session?.user) return <>{children}</>;

  const t = await getTranslations("Header");
  const [actor, latestBatch, openExceptionCount] = await Promise.all([
    getCurrentActor(),
    getLatestImportBatch(),
    countOpenExceptions(),
  ]);
  // Open red + yellow cases, for the Cases link's badge.
  const casesNeedingAttention = canWorkCases(actor) ? await attentionCount() : 0;
  const latestBatchLabel = latestBatch ? `${latestBatch.fileName} — ${latestBatch.loadedAt.toISOString().slice(0, 10)}` : null;

  return (
    <OpenTabsProvider>
      <PanelWidthsRoot className="flex h-screen flex-col overflow-hidden">
        <header className="flex h-[52px] flex-none items-stretch bg-pn-ink text-white">
          <div data-r="brand" className="flex w-[var(--pn-nav-w,248px)] flex-none items-center overflow-hidden gap-2.5 border-r-2 border-pn-gray-2 px-5 max-[1180px]:w-auto max-[1180px]:px-4">
            <div className="h-3.5 w-3.5 flex-none bg-pn-accent" />
            <span data-r="navtext" className="max-[1180px]:hidden text-sm font-extrabold tracking-[-0.01em] whitespace-nowrap">
              {t("brand")}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
            <Suspense fallback={<div className="h-8 max-w-[560px] flex-1 border-2 border-pn-gray-1 bg-[#1d2b23]" />}>
              <HeaderSearch />
            </Suspense>
            <OpenTabsBar />
            <span data-r="hide-md" className="max-[1180px]:hidden text-[11px] tracking-[0.06em] text-pn-gray-4 uppercase whitespace-nowrap">
              {t("directory")}
            </span>
          </div>
          <div className="flex items-center gap-3.5 border-l-2 border-pn-gray-2 px-[18px]">
            <CloseRecordButton />
            <Suspense fallback={<div className="h-[26px] w-[68px] border-2 border-pn-gray-1" />}>
              <LocaleSwitcher />
            </Suspense>
            <span data-r="hide-md" className="max-[1180px]:hidden text-[11px] tracking-[0.05em] text-pn-border-muted uppercase">
              {t("role")}
            </span>
            <span data-r="hide-sm" className="max-[1040px]:hidden text-xs font-semibold whitespace-nowrap">
              {actor.role?.name ?? t("noRole")}
            </span>
            <div className="flex h-[26px] w-[26px] items-center justify-center bg-pn-accent text-[11px] font-bold text-white" title={actor.name ?? actor.email}>
              {initials(actor.name, actor.email)}
            </div>
            <Link href="/change-password" aria-label={t("changePassword")} className="text-pn-gray-4 hover:text-white">
              <KeyRound size={15} strokeWidth={2} />
            </Link>
            <form action={logoutAction}>
              <button type="submit" aria-label={t("signOut")} className="cursor-pointer text-pn-gray-4 hover:text-white">
                <LogOut size={15} strokeWidth={2} />
              </button>
            </form>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <SidebarNav
            latestBatchLabel={latestBatchLabel}
            openExceptionCount={openExceptionCount}
            canEditValueLists={canEditValueLists(actor)}
            canManageUsers={canManageUsers(actor)}
            canViewReports={canViewReports(actor)}
            canManageMembers={canManageMembers(actor)}
            canWorkCases={canWorkCases(actor)}
            casesNeedingAttention={casesNeedingAttention}
          />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
      </PanelWidthsRoot>
    </OpenTabsProvider>
  );
}
