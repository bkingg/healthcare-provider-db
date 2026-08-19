"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addBankingPaymentAction, approveBankingPaymentAction, deleteBankingPaymentAction } from "@/app/[locale]/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { StatusBadge } from "@/components/status-badge";
import { PhoneNumberField } from "./phone-number-field";
import { Button } from "@/components/ui/button";
import { ApprovalStatus } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

// TODO(Phase 5): this section renders unconditionally today because
// canViewBanking() always returns true (see src/data/financial.ts). Once RBAC
// lands, the page passes `canView`/`canManage` from the real actor and this
// component already branches on them correctly.
export function BankingSection({
  provider,
  paymentTypes,
  bankAccountTypes,
  canView,
  canManage,
}: {
  provider: ProviderProfile;
  paymentTypes: { id: string; label: string; category: string }[];
  bankAccountTypes: { id: string; label: string }[];
  canView: boolean;
  canManage: boolean;
}) {
  const t = useTranslations("Sections.Banking");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addBankingPaymentAction, null);
  const errors = state && !state.success ? state.errors : {};
  // The form asks for different details per payment type: bank account
  // fields for a bank type, wallet number + merchant code for mobile money
  // (Orange Money, Wave, ...).
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const isMobileMoney = paymentTypes.find((p) => p.id === paymentTypeId)?.category === "MOBILE_MONEY";

  if (!canView) {
    return (
      <PnSection title={t("title")}>
        <p className="text-sm text-pn-gray-3">{t("restricted")}</p>
      </PnSection>
    );
  }

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colPayee")}</TableHead>
              <TableHead>{t("colPaymentType")}</TableHead>
              <TableHead>{t("colDetails")}</TableHead>
              <TableHead>{t("colApproval")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.bankingPayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  {payment.payeeName} <span className="text-muted-foreground">({payment.currency})</span>
                </TableCell>
                <TableCell>{payment.paymentType.name}</TableCell>
                <TableCell className="text-xs">
                  {payment.mobileMoneyNumber || payment.merchantCode ? (
                    <div className="flex flex-col">
                      {payment.mobileMoneyNumber && <span>{payment.mobileMoneyNumber}</span>}
                      {payment.merchantCode && (
                        <span className="text-muted-foreground">
                          {t("merchantCodeShort")}: {payment.merchantCode}
                        </span>
                      )}
                    </div>
                  ) : (
                    [payment.bankName, payment.bankAccountNumber].filter(Boolean).join(" · ") || "—"
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={payment.approvalStatus} />
                </TableCell>
                <TableCell className="flex items-center gap-1">
                  {canManage && payment.approvalStatus !== ApprovalStatus.APPROVED && (
                    <form action={approveBankingPaymentAction}>
                      <input type="hidden" name="id" value={payment.id} />
                      <input type="hidden" name="providerId" value={provider.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t("approve")}
                      </Button>
                    </form>
                  )}
                  {canManage && (
                    <InlineDeleteForm action={deleteBankingPaymentAction} hiddenFields={{ id: payment.id, providerId: provider.id }} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {canManage && (
          <form action={formAction} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="providerId" value={provider.id} />
            <div className="flex flex-col gap-1.5">
              <Label>{t("paymentType")}</Label>
              <RefSelect name="paymentTypeId" options={paymentTypes} value={paymentTypeId} onValueChange={setPaymentTypeId} required />
              <FieldError messages={errors.paymentTypeId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">{t("currency")}</Label>
              <Input id="currency" name="currency" maxLength={3} placeholder="XOF" required />
              <FieldError messages={errors.currency} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payeeName">{t("payeeName")}</Label>
              <Input id="payeeName" name="payeeName" required />
              <FieldError messages={errors.payeeName} />
            </div>
            {isMobileMoney ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("mobileMoneyNumber")}</Label>
                  <PhoneNumberField name="mobileMoneyNumber" defaultCountryIso2={provider.country.iso2} placeholder={t("mobileMoneyNumberPlaceholder")} required />
                  <FieldError messages={errors.mobileMoneyNumber} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="merchantCode">{t("merchantCode")}</Label>
                  <Input id="merchantCode" name="merchantCode" inputMode="numeric" />
                  <FieldError messages={errors.merchantCode} />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("bankAccountType")}</Label>
                  <RefSelect name="bankAccountTypeId" options={bankAccountTypes} placeholder={t("bankAccountTypeNone")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bankName">{t("bankName")}</Label>
                  <Input id="bankName" name="bankName" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bankAccountNumber">{t("accountNumber")}</Label>
                  <Input id="bankAccountNumber" name="bankAccountNumber" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bankRoutingOrSwift">{t("routingSwift")}</Label>
                  <Input id="bankRoutingOrSwift" name="bankRoutingOrSwift" />
                </div>
              </>
            )}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="countrySpecificFieldsRaw">{t("countrySpecificFields")}</Label>
              <Textarea id="countrySpecificFieldsRaw" name="countrySpecificFieldsRaw" rows={2} placeholder='{"ninea": "123456789"}' />
              <FieldError messages={errors.countrySpecificFieldsRaw} />
            </div>
            <div className="col-span-2">
              <SubmitButton variant="outline">{t("add")}</SubmitButton>
            </div>
          </form>
        )}
    </PnSection>
  );
}
