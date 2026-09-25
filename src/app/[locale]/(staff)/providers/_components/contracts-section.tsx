"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { addNetworkContractAction, deleteNetworkContractAction, updateNetworkContractAction } from "@/app/[locale]/(staff)/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ContractStatus } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

type Options = { id: string; label: string }[];
type Contract = ProviderProfile["networkContracts"][number];

/** Shared by the permanently-visible "Add" form below and the edit dialog —
 * same field set either way (see EditNetworkContractDialog). */
function ContractFields({ t, networks, errors, defaults }: { t: ReturnType<typeof useTranslations>; networks: Options; errors: Record<string, string[] | undefined>; defaults?: Contract }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>{t("formNetwork")}</Label>
        <RefSelect name="networkId" options={networks} defaultValue={defaults?.networkId} required />
        <FieldError messages={errors.networkId} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("formStatus")}</Label>
        <RefSelect
          name="status"
          options={Object.values(ContractStatus).map((v) => ({ id: v, label: v.replaceAll("_", " ") }))}
          defaultValue={defaults?.status ?? ContractStatus.DRAFT}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="effectiveDate">{t("effectiveDate")}</Label>
        <Input
          id="effectiveDate"
          name="effectiveDate"
          type="date"
          defaultValue={defaults ? new Date(defaults.effectiveDate).toISOString().slice(0, 10) : undefined}
          required
        />
        <FieldError messages={errors.effectiveDate} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endDate">{t("endDate")}</Label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={defaults?.endDate ? new Date(defaults.endDate).toISOString().slice(0, 10) : undefined}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="externalReferenceId">{t("externalReferenceId")}</Label>
        <Input
          id="externalReferenceId"
          name="externalReferenceId"
          placeholder={t("externalReferenceIdPlaceholder")}
          defaultValue={defaults?.externalReferenceId ?? ""}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="comments">{t("comments")}</Label>
        <Input id="comments" name="comments" defaultValue={defaults?.comments ?? ""} />
      </div>
    </>
  );
}

function EditNetworkContractDialog({ contract, providerId, networks }: { contract: Contract; providerId: string; networks: Options }) {
  const t = useTranslations("Sections.Contracts");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateNetworkContractAction, null);
  const errors = state && !state.success ? state.errors : {};

  // "Save" doubles as "Save & Close" — same as EditAddressDialog. Adjusting
  // state during render (not in an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("edit")}>
            <Pencil size={14} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        {/* Keyed on updatedAt: a save feeds this same mounted dialog fresh
         * `contract` data while it may still be open — without a remount,
         * the uncontrolled fields' defaultValue would go stale (same class
         * of bug as EditAddressDialog). */}
        <form key={contract.updatedAt.getTime()} action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={contract.id} />
          <input type="hidden" name="providerId" value={providerId} />
          <ContractFields t={t} networks={networks} errors={errors} defaults={contract} />
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContractsSection({ provider, networks }: { provider: ProviderProfile; networks: Options }) {
  const t = useTranslations("Sections.Contracts");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addNetworkContractAction, null);
  const errors = state && !state.success ? state.errors : {};

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colNetwork")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colEffective")}</TableHead>
              <TableHead>{t("colExternalRef")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.networkContracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>{contract.network.name}</TableCell>
                <TableCell>
                  <StatusBadge status={contract.status} />
                </TableCell>
                <TableCell>{new Date(contract.effectiveDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground">{contract.externalReferenceId ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <EditNetworkContractDialog contract={contract} providerId={provider.id} networks={networks} />
                    <InlineDeleteForm action={deleteNetworkContractAction} hiddenFields={{ id: contract.id, providerId: provider.id }} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <form action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="providerId" value={provider.id} />
          <ContractFields t={t} networks={networks} errors={errors} />
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("add")}</SubmitButton>
          </div>
        </form>
      </PnSection>
  );
}
