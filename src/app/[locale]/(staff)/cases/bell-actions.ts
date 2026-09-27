"use server";

import { z } from "zod";
import { getCurrentActor } from "@/lib/actor";
import { canWorkCases } from "@/lib/rbac";
import { bellFor, markAllNotificationsRead, markNotificationRead } from "@/data/caseActions";
import { toBellData, type BellData } from "@/lib/bellData";

/** The header bell's data, refreshed by the bell itself on each page change
 * and every minute. Empty for staff who don't work cases. */
export async function getBellAction(): Promise<BellData | null> {
  const actor = await getCurrentActor();
  if (!canWorkCases(actor)) return null;
  return toBellData(await bellFor(actor.id));
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const actor = await getCurrentActor();
  await markNotificationRead(z.uuid().parse(notificationId), actor.id);
}

export async function markAllNotificationsReadAction(): Promise<BellData | null> {
  const actor = await getCurrentActor();
  if (!canWorkCases(actor)) return null;
  await markAllNotificationsRead(actor.id);
  return toBellData(await bellFor(actor.id));
}
