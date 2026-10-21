import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/memberAuth";
import { pushConfigured } from "@/lib/push";

/** Turns phone alerts on or off for this device. `who` says which sign-in
 * it's for: the member app or the staff app (a staff phone can't get member
 * alerts, and the other way round). Not covered by proxy.ts (it skips /api),
 * so the session is checked here. */

const subscriptionSchema = z.object({
  who: z.enum(["member", "staff"]),
  locale: z.enum(["fr", "en"]),
  subscription: z.object({
    endpoint: z.url({ protocol: /^https$/ }).max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
});

async function owner(who: "member" | "staff"): Promise<{ memberId: string } | { userId: string } | null> {
  if (who === "member") {
    const member = await getCurrentMember();
    return member ? { memberId: member.id } : null;
  }
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, role: { select: { canWorkCases: true, isActive: true } } } });
  return user?.isActive && user.role?.isActive && user.role.canWorkCases ? { userId } : null;
}

export async function POST(request: Request) {
  if (!pushConfigured()) return NextResponse.json({ error: "notConfigured" }, { status: 503 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { who, locale, subscription } = parsed.data;
  const by = await owner(who);
  if (!by) return NextResponse.json({ error: "signedOut" }, { status: 401 });
  const data = {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    locale,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    // A device belongs to whoever turned alerts on last.
    memberId: "memberId" in by ? by.memberId : null,
    userId: "userId" in by ? by.userId : null,
  };
  await prisma.pushSubscription.upsert({ where: { endpoint: subscription.endpoint }, create: { endpoint: subscription.endpoint, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

const removeSchema = z.object({ endpoint: z.string().min(1).max(1000) });

/** Off on this device. Only the device's own owner can remove it — knowing
 * the endpoint is enough, since only that browser has it. */
export async function DELETE(request: Request) {
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } });
  return NextResponse.json({ ok: true });
}
