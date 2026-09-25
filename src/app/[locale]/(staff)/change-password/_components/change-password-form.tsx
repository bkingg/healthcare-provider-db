"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePasswordAction } from "@/app/[locale]/(staff)/change-password/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

export function ChangePasswordForm() {
  const t = useTranslations("ChangePassword");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
        <FieldError messages={errors.newPassword} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
        <FieldError messages={errors.confirmPassword} />
      </div>
      <SubmitButton className="mt-1">{t("save")}</SubmitButton>
    </form>
  );
}
