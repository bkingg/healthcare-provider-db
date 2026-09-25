import "server-only";
import { getLocale } from "next-intl/server";
import { listCountries } from "@/data/referenceData";
import { listActiveOrganizations, listActiveRelationships, listPrimaryMemberOptions } from "@/data/members";
import { formatMemberNumber } from "@/lib/memberNumber";
import { localizedText } from "@/lib/localizedText";
import type { MemberFormOptions } from "./member-form-dialog";

/** Dropdown options for the member form, shared by the list and detail pages. */
export async function loadMemberFormOptions(): Promise<MemberFormOptions> {
  const locale = await getLocale();
  const [countries, organizations, relationships, primaries] = await Promise.all([
    listCountries(),
    listActiveOrganizations(),
    listActiveRelationships(),
    listPrimaryMemberOptions(),
  ]);
  return {
    countries: countries.map((c) => ({ id: c.id, label: c.name })),
    organizations: organizations.map((o) => ({ id: o.id, label: o.name })),
    relationships: relationships.map((r) => ({ id: r.id, label: localizedText(r.nameEn, r.nameFr, locale) ?? r.nameEn })),
    primaryMembers: primaries.map((p) => ({ id: p.id, label: `${p.lastName.toUpperCase()} ${p.firstName} · ${formatMemberNumber(p.memberNumber)}` })),
  };
}
