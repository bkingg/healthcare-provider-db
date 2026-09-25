"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setProviderNetworkGroupsAction } from "@/app/[locale]/(staff)/providers/actions";
import { useCanEdit } from "@/lib/can-edit-context";
import { PnSection } from "@/components/pn-section";
import { Label } from "@/components/ui/label";
import { MultiRefSelect } from "@/components/multi-ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

type Options = { id: string; label: string }[];

/** The two network multi-selects at the bottom of Contracts & networks —
 * Specialized Network and Customized Client Network, both admin-managed value
 * lists (Admin > Value lists). Saved together; the current picks also appear
 * on the Overview tab. */
export function NetworkGroupsSection({
  provider,
  specializedNetworks,
  customizedClientNetworks,
}: {
  provider: ProviderProfile;
  specializedNetworks: Options;
  customizedClientNetworks: Options;
}) {
  const t = useTranslations("Sections.NetworkGroups");
  const tp = useTranslations("Profile");
  const canEdit = useCanEdit();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(setProviderNetworkGroupsAction, null);
  const errors = state && !state.success ? state.errors : {};

  const specializedIds = provider.specializedNetworks.map((n) => n.specializedNetworkId);
  const customizedIds = provider.customizedClientNetworks.map((n) => n.customizedClientNetworkId);

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
      {/* Keyed on updatedAt: a save refreshes `provider` under this same
       * mounted form, and MultiRefSelect only reads defaultValue on mount. */}
      <form key={provider.updatedAt.getTime()} action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <input type="hidden" name="providerId" value={provider.id} />
        <div className="flex flex-col gap-1.5">
          <Label>{tp("specializedNetwork")}</Label>
          {canEdit ? (
            <MultiRefSelect name="specializedNetworkIds" options={specializedNetworks} defaultValue={specializedIds} placeholder={t("placeholder")} />
          ) : (
            <p className="m-0 text-[12.5px]">{provider.specializedNetworks.map((n) => n.specializedNetwork.name).join(", ") || t("none")}</p>
          )}
          {canEdit && specializedNetworks.length === 0 && <p className="text-xs text-pn-gray-3">{t("emptyList")}</p>}
          <FieldError messages={errors.specializedNetworkIds} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{tp("customizedClientNetwork")}</Label>
          {canEdit ? (
            <MultiRefSelect
              name="customizedClientNetworkIds"
              options={customizedClientNetworks}
              defaultValue={customizedIds}
              placeholder={t("placeholder")}
            />
          ) : (
            <p className="m-0 text-[12.5px]">{provider.customizedClientNetworks.map((n) => n.customizedClientNetwork.name).join(", ") || t("none")}</p>
          )}
          {canEdit && customizedClientNetworks.length === 0 && <p className="text-xs text-pn-gray-3">{t("emptyList")}</p>}
          <FieldError messages={errors.customizedClientNetworkIds} />
        </div>
        {canEdit && (
          <div className="md:col-span-2">
            <SubmitButton variant="outline">{t("save")}</SubmitButton>
          </div>
        )}
      </form>
    </PnSection>
  );
}
