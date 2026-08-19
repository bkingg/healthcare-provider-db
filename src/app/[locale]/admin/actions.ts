"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/actor";
import { requireEditValueLists, requireManageUsers } from "@/lib/rbac";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { fail, type ActionResult } from "@/lib/validation/common";
import { referenceItemSchema } from "@/lib/validation/referenceLists";
import { REFERENCE_LIST_DEFS, type ReferenceListDef, type ReferenceListKey } from "@/lib/referenceListDefs";
import * as adminData from "@/data/adminReferenceLists";

function revalidateAdmin() {
  revalidatePath("/[locale]/admin", "page");
}

/** Every mutation in this file re-checks the relevant permission
 * server-side — the nav link and the page itself already hide behind it,
 * but a form POST doesn't go through either of those, so this is the actual
 * enforcement point (same reasoning as providers/actions.ts's
 * requireEditProviderData). Roles are access-control data, not a plain
 * value list, so editing them needs canManageUsers even though they go
 * through the same generic reference-list UI as every other list. */
async function requireAdmin(listKey: ReferenceListKey) {
  const actor = await getCurrentActor();
  if (listKey === "userRoles") requireManageUsers(actor);
  else requireEditValueLists(actor);
  return actor;
}

function parseListKey(formData: FormData): ReferenceListKey {
  const key = z.string().parse(formData.get("listKey"));
  if (!(key in REFERENCE_LIST_DEFS)) throw new Error(`Unknown reference list "${key}"`);
  return key as ReferenceListKey;
}

/** Zod only checks "is this field non-empty" (see requiredString in
 * validation/common.ts) — actual uniqueness of `code`/`iso2` is enforced by
 * the DB's `@unique` constraint, so a duplicate only surfaces once the
 * insert/update actually runs. Caught here (rather than left to crash as an
 * unhandled 500) and turned into the same field-level error shape the rest
 * of this form already knows how to render. */
function duplicateCodeError(listKey: ReferenceListKey, value: unknown): ActionResult {
  const def = REFERENCE_LIST_DEFS[listKey];
  const shown = typeof value === "string" ? value : "";
  return fail({ [def.codeField.key]: [`"${shown}" is already in use — pick a different ${def.codeField.labelKey}.`] });
}

/** Lists flagged `editOnly` (see referenceListDefs.ts) are a fixed set of
 * rows the app looks up by code — text edits only. */
function assertNotEditOnly(listKey: ReferenceListKey) {
  if ((REFERENCE_LIST_DEFS[listKey] as ReferenceListDef).editOnly) throw new Error(`"${listKey}" values can be edited but not added or deactivated`);
}

export async function addReferenceItemAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const listKey = parseListKey(formData);
  assertNotEditOnly(listKey);
  const actor = await requireAdmin(listKey);
  const parsed = referenceItemSchema(listKey).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  try {
    await adminData.createReferenceItem(listKey, parsed.data, actor.id);
  } catch (err) {
    if (isUniqueConstraintError(err)) return duplicateCodeError(listKey, parsed.data[REFERENCE_LIST_DEFS[listKey].codeField.key]);
    throw err;
  }
  revalidateAdmin();
  return { success: true };
}

export async function updateReferenceItemAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const listKey = parseListKey(formData);
  const actor = await requireAdmin(listKey);
  const id = z.uuid().parse(formData.get("id"));
  const parsed = referenceItemSchema(listKey).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  try {
    await adminData.updateReferenceItem(listKey, id, parsed.data, actor.id);
  } catch (err) {
    if (isUniqueConstraintError(err)) return duplicateCodeError(listKey, parsed.data[REFERENCE_LIST_DEFS[listKey].codeField.key]);
    throw err;
  }
  revalidateAdmin();
  return { success: true };
}

export async function setReferenceItemActiveAction(formData: FormData): Promise<void> {
  const listKey = parseListKey(formData);
  assertNotEditOnly(listKey);
  const actor = await requireAdmin(listKey);
  const id = z.uuid().parse(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await adminData.setReferenceItemActive(listKey, id, isActive, actor.id);
  revalidateAdmin();
}

/** Region admin's "Manage countries" dialog — see setRegionCountries in
 * adminReferenceLists.ts for the diff/reassignment logic. Regions are a
 * plain value list (not access-control data), so this uses
 * requireEditValueLists directly rather than requireAdmin. */
export async function setRegionCountriesAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor();
  requireEditValueLists(actor);
  const regionId = z.uuid().parse(formData.get("regionId"));
  const countryIds = formData.getAll("countryIds").map((v) => z.uuid().parse(v));
  await adminData.setRegionCountries(regionId, countryIds, actor.id);
  revalidateAdmin();
  return { success: true };
}
