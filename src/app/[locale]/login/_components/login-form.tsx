"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "@/app/[locale]/login/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

export function LoginForm() {
  const t = useTranslations("Login");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(loginAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldError messages={errors.form} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton className="mt-1">{t("signIn")}</SubmitButton>
    </form>
  );
}
