import { ProviderNameKind } from "@/lib/enums";

/** Single source of truth for turning a name-kind-specific field set into the
 * denormalized `fullNameText` every ProviderName row carries — used both at
 * provider creation and whenever an additional name variant is added, so the
 * concatenation rule (title + first + last for an individual, the facility
 * name as-is for an entity) only lives in one place. Takes the title's
 * already-resolved display text (e.g. "Dr."), not its ProviderTitleRef id —
 * this stays a pure function, so the DB lookup is the caller's job. */
export function buildFullNameText(input: {
  nameKind: ProviderNameKind;
  facilityName?: string;
  individualTitleName?: string;
  individualFirstName?: string;
  individualLastName?: string;
}): string {
  if (input.nameKind === ProviderNameKind.INDIVIDUAL) {
    return [input.individualTitleName, input.individualFirstName, input.individualLastName].filter(Boolean).join(" ");
  }
  return input.facilityName ?? "";
}
