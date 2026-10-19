import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** Member app services that can be switched off in Admin > Value lists >
 * Member app features — separately for covered members and for members
 * without cover (special requests, e.g. quick start). A missing row counts
 * as on, so a service never disappears just because its row wasn't made. */
export type MemberFeature = "REQUEST_HELP" | "ORDER_MEDICATION";
export type MemberFeatures = Record<MemberFeature, boolean>;

const loadRows = cache(() => prisma.memberAppFeature.findMany({ where: { isActive: true }, select: { code: true, enabled: true, enabledForNotCovered: true } }));

/** What this member is offered: by `isCovered` (false for a quick-start
 * account, before it exists). */
export async function memberFeatures(who: { isCovered: boolean }): Promise<MemberFeatures> {
  const rows = await loadRows();
  const on = (code: MemberFeature) => {
    const r = rows.find((x) => x.code === code);
    return r ? (who.isCovered ? r.enabled : r.enabledForNotCovered) : true;
  };
  return { REQUEST_HELP: on("REQUEST_HELP"), ORDER_MEDICATION: on("ORDER_MEDICATION") };
}
