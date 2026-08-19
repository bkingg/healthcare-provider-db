import { Prisma } from "../../generated/prisma/client";

/** True for a unique-constraint violation (Prisma error code P2002) — e.g. a
 * reference list's `code`/`iso2` column, or CountryRef.iso2 when
 * find-or-create loses a race with a concurrent insert. Callers use this to
 * turn a raw DB error into a friendly "already exists" message instead of
 * letting it bubble up as an unhandled 500. */
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
