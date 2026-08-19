"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { signIn } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { fail, type ActionResult } from "@/lib/validation/common";

/** signIn(..., { redirect: false }) still throws on bad credentials (an
 * AuthError subclass — CredentialsSignin) rather than returning an "error"
 * URL to check, so failure is caught here, not inspected from a return
 * value. Only the try/catch wraps signIn() itself — the success path's
 * redirect() below throws its own (Next.js-internal, digest-tagged)
 * control-flow error, which must NOT be swallowed by this catch. */
export async function loginAction(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail({ form: ["Enter your email and password."] });

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return fail({ form: ["Invalid email or password."] });
    throw err;
  }

  const locale = await getLocale();
  return redirect({ href: "/providers", locale });
}
