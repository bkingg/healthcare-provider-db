import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Phase 5: real authentication. Every mutation still stamps
 * createdBy/updatedBy/AuditLog.changedBy with this actor's id — that part of
 * the Phase 1 design didn't change, only where the id comes from (the
 * NextAuth session instead of a hardcoded lookup). Includes `role` since
 * every permission check (src/lib/rbac.ts) reads `actor.role`.
 *
 * Throws if there's no session — proxy.ts already redirects unauthenticated
 * requests to /login before they reach a page or Server Function, so this
 * should only ever throw if that redirect were somehow bypassed (the Next.js
 * docs' own warning: verify auth inside each Server Function, not just in
 * Proxy), in which case failing loudly is the right behavior.
 */
export const getCurrentActor = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated");
  }
  const actor = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!actor || !actor.isActive) {
    throw new Error("Not authenticated");
  }
  return actor;
});
