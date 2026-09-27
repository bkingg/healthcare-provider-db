import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentActor } from "@/lib/actor";
import { canEditProviderData, canEditValueLists, canManageMembers, canManageUsers, canViewReports, canWorkCases, maxSearchResults } from "@/lib/rbac";
import { formatDakarDate, formatDakarDateTime } from "@/lib/formatDate";
import { PasswordSection } from "./_components/password-section";

/** The signed-in staff member's own account: details (view only — admins
 * change them in Admin → Users) and, behind a button, the password change. */
export default async function SettingsPage() {
  const actor = await getCurrentActor();
  const t = await getTranslations("Settings");
  const locale = await getLocale();

  const permissions = [
    canWorkCases(actor) && t("perm.workCases"),
    canManageMembers(actor) && t("perm.manageMembers"),
    canEditProviderData(actor) && t("perm.editProviders"),
    canViewReports(actor) && t("perm.viewReports"),
    canEditValueLists(actor) && t("perm.editValueLists"),
    canManageUsers(actor) && t("perm.manageUsers"),
  ].filter((p): p is string => Boolean(p));
  const limit = maxSearchResults(actor);

  const rows: [string, React.ReactNode][] = [
    [t("name"), actor.name ?? "—"],
    [t("handle"), <span key="h" className="font-semibold">@{actor.handle}</span>],
    [t("email"), actor.email],
    [t("role"), actor.role?.name ?? t("noRole")],
    [t("permissions"), permissions.length ? permissions.join(" · ") : t("noPermissions")],
    [t("searchLimit"), limit === null ? t("unlimited") : t("resultsCount", { count: limit })],
    [t("lastSignIn"), actor.lastLoginAt ? formatDakarDateTime(actor.lastLoginAt, locale) : "—"],
    [t("memberSince"), formatDakarDate(actor.createdAt, locale)],
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>

      <section className="border-2 border-pn-ink">
        <h2 className="m-0 bg-pn-ink px-4 py-2 text-[11px] font-bold tracking-[0.08em] text-white uppercase">{t("myDetails")}</h2>
        <dl className="m-0 grid grid-cols-[170px_minmax(0,1fr)] max-[560px]:grid-cols-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="border-b border-pn-rule px-4 py-2.5 text-[12px] text-pn-gray-2 max-[560px]:border-b-0 max-[560px]:pb-0">{label}</dt>
              <dd className="m-0 border-b border-pn-rule px-4 py-2.5 text-[13px] text-pn-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="m-0 px-4 py-2.5 text-[12px] text-pn-gray-3">{t("askAdmin")}</p>
      </section>

      <PasswordSection />
    </div>
  );
}
