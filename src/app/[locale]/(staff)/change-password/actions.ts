"use server";

import { getLocale } from "next-intl/server";
import { getCurrentActor } from "@/lib/actor";
import { redirect } from "@/i18n/navigation";
import { fail, type ActionResult } from "@/lib/validation/common";
import { changePasswordSchema } from "@/lib/validation/users";
import { changeOwnPassword } from "@/data/users";

export async function changePasswordAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.flatten().fieldErrors);

  const actor = await getCurrentActor();
  await changeOwnPassword(actor.id, parsed.data.newPassword);

  // A voluntary change (from Settings) stays put; the forced change after a
  // temporary password carries on into the app.
  if (!actor.mustChangePassword) return { success: true };
  const locale = await getLocale();
  return redirect({ href: "/providers", locale });
}
