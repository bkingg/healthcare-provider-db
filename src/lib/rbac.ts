import "server-only";
import type { User, UserRole } from "../../generated/prisma/client";

type Actor = User & { role: UserRole | null };

/** A deactivated role's permissions don't apply — same "isActive gates
 * whether the row still counts" rule as every other reference table. An
 * actor whose role was deactivated (or who has none assigned yet) falls
 * back to "no permissions" rather than erroring, so they can still view the
 * (read-only) app while an admin sorts out their access. */
function role(actor: Actor): UserRole | null {
  return actor.role?.isActive ? actor.role : null;
}

export function canEditValueLists(actor: Actor): boolean {
  return role(actor)?.canEditValueLists ?? false;
}

export function canViewReports(actor: Actor): boolean {
  return role(actor)?.canViewReports ?? false;
}

export function canManageUsers(actor: Actor): boolean {
  return role(actor)?.canManageUsers ?? false;
}

export function canEditProviderData(actor: Actor): boolean {
  return role(actor)?.canEditProviderData ?? false;
}

export function canManageMembers(actor: Actor): boolean {
  return role(actor)?.canManageMembers ?? false;
}

export function canWorkCases(actor: Actor): boolean {
  return role(actor)?.canWorkCases ?? false;
}

/** Null means unlimited. Applied to both `searchProviders` and
 * `searchProvidersForMap` so a capped role can't bypass the limit by
 * switching screens. A per-user override (User.maxSearchResults, editable on
 * the admin Users screen) takes precedence over the role's default when
 * set, so one employee can be tightened or loosened without splitting them
 * into a whole new role. */
export function maxSearchResults(actor: Actor): number | null {
  return actor.maxSearchResults ?? role(actor)?.maxSearchResults ?? null;
}

/** Throws (rather than returning a boolean) for the write-path guards in
 * providers/actions.ts and admin/actions.ts — every mutating Server
 * Function calls one of these as its first line after getCurrentActor(), so
 * a Case Manager's (or anyone else lacking the permission) POST is rejected
 * before any DB write happens, regardless of what the UI does or doesn't
 * show them. */
export function requireEditProviderData(actor: Actor) {
  if (!canEditProviderData(actor)) throw new Error("Not authorized to edit provider records");
}

export function requireManageUsers(actor: Actor) {
  if (!canManageUsers(actor)) throw new Error("Not authorized to manage users");
}

export function requireWorkCases(actor: Actor) {
  if (!canWorkCases(actor)) throw new Error("Not authorized to work cases");
}

export function requireManageMembers(actor: Actor) {
  if (!canManageMembers(actor)) throw new Error("Not authorized to manage members");
}

export function requireEditValueLists(actor: Actor) {
  if (!canEditValueLists(actor)) throw new Error("Not authorized to edit value lists");
}

export function requireViewReports(actor: Actor) {
  if (!canViewReports(actor)) throw new Error("Not authorized to view reports");
}
