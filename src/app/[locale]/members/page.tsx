import { getLocale, getTranslations } from "next-intl/server";
import { localizedText } from "@/lib/localizedText";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentActor } from "@/lib/actor";
import { requireManageMembers } from "@/lib/rbac";
import { formatMemberNumber, ageFromDateOfBirth } from "@/lib/memberNumber";
import { memberSearchSchema } from "@/lib/validation/members";
import { searchMembers, listActiveOrganizations } from "@/data/members";
import { PnTag } from "@/components/pn-tag";
import { MemberFormDialog } from "./_components/member-form-dialog";
import { loadMemberFormOptions } from "./_components/form-options";

export default async function MembersPage(props: PageProps<"/[locale]/members">) {
  const t = await getTranslations("Members");
  const locale = await getLocale();
  const actor = await getCurrentActor();
  requireManageMembers(actor);

  const raw = await props.searchParams;
  const filters = memberSearchSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    organizationId: typeof raw.organizationId === "string" ? raw.organizationId : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  });
  const [{ members, total, limit }, organizations, formOptions] = await Promise.all([
    searchMembers(filters),
    listActiveOrganizations(),
    loadMemberFormOptions(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-none flex-wrap items-end justify-between gap-4 border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
          <div className="mt-[5px] text-xs text-pn-gray-2">
            <strong className="text-pn-ink tabular-nums">{total.toLocaleString()}</strong> {t("resultsLabel")}
            {total > limit && <span className="ml-2 font-semibold text-pn-accent">{t("showingFirst", { limit })}</span>}
          </div>
        </div>
        <MemberFormDialog mode="create" options={formOptions} />
      </div>

      {/* Plain GET form: the search lives in the URL, so it survives a
       * reload and can be shared, same as the provider search. */}
      <form method="get" className="flex flex-none flex-wrap items-end gap-2 border-b border-pn-rule px-5 py-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("search")}
          <span className="flex h-8 items-center gap-2 border-2 border-pn-border-muted bg-white px-2 focus-within:border-pn-ink">
            <Search size={14} className="text-pn-gray-3" />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder={t("searchPlaceholder")}
              className="h-full flex-1 bg-transparent text-[13px] tracking-normal text-pn-ink normal-case outline-none"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("organization")}
          <select name="organizationId" defaultValue={filters.organizationId ?? ""} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            <option value="">{t("allOrganizations")}</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {t("status")}
          <select name="status" defaultValue={filters.status} className="h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] tracking-normal text-pn-ink normal-case">
            <option value="ACTIVE">{t("statusACTIVE")}</option>
            <option value="INACTIVE">{t("statusINACTIVE")}</option>
            <option value="ALL">{t("statusALL")}</option>
          </select>
        </label>
        <button type="submit" className="h-8 cursor-pointer border-2 border-pn-ink bg-pn-ink px-4 text-xs font-semibold text-white">
          {t("searchButton")}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-pn-ink bg-pn-panel text-left text-[10px] font-bold tracking-[0.07em] text-pn-gray-1 uppercase">
              <th className="px-5 py-2">{t("colMember")}</th>
              <th className="px-3 py-2">{t("colNumber")}</th>
              <th className="px-3 py-2">{t("colHousehold")}</th>
              <th className="px-3 py-2">{t("colOrganization")}</th>
              <th className="px-3 py-2">{t("colAge")}</th>
              <th className="px-3 py-2">{t("colContact")}</th>
              <th className="px-3 py-2">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const age = ageFromDateOfBirth(m.dateOfBirth);
              return (
                <tr key={m.id} className="border-b border-pn-rule hover:bg-pn-surface-hover">
                  <td className="px-5 py-2">
                    <Link href={`/members/${m.id}`} className="font-semibold text-pn-ink hover:underline">
                      {m.lastName.toUpperCase()} {m.firstName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-pn-gray-2 tabular-nums">{formatMemberNumber(m.memberNumber)}</td>
                  <td className="px-3 py-2 text-pn-gray-1">
                    {m.primaryMember ? (
                      <>
                        {((m.relationship && localizedText(m.relationship.nameEn, m.relationship.nameFr, locale)) ?? t("dependent")) + " · "}
                        <Link href={`/members/${m.primaryMember.id}`} className="hover:underline">
                          {m.primaryMember.firstName} {m.primaryMember.lastName}
                        </Link>
                      </>
                    ) : (
                      <>
                        {t("primary")}
                        {m._count.dependents > 0 && <span className="text-pn-gray-3"> · {t("dependentsCount", { count: m._count.dependents })}</span>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-pn-gray-1">{m.organization?.name ?? <span className="text-pn-gray-3">{t("individual")}</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{age ?? "—"}</td>
                  <td className="px-3 py-2 text-pn-gray-2">{m.email ?? m.phone ?? "—"}</td>
                  <td className="px-3 py-2">
                    <PnTag status={m.status} />
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-pn-gray-3">
                  {filters.q || filters.organizationId ? t("noResults") : t("noMembersYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
