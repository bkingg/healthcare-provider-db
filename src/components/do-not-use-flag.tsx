"use client";

import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { HoverTip } from "@/components/ui/tooltip";
import { ProviderStatus } from "@/lib/enums";

export const DO_NOT_USE_RED = "#dc2626";

export function isDoNotUse(status: string | null | undefined): boolean {
  return status === ProviderStatus.DO_NOT_USE;
}

/** Filled red flag shown next to a provider's name wherever it's listed
 * (record header, search results, geospatial list and map popup) when the
 * provider's status is DO_NOT_USE — so it can't be missed even where the
 * status tag is off screen or its column is hidden. Renders nothing for
 * any other status, so call sites can drop it in unconditionally. */
export function DoNotUseFlag({ status, size = 14 }: { status: string | null | undefined; size?: number }) {
  const t = useTranslations("Common");
  if (!isDoNotUse(status)) return null;
  return (
    <HoverTip content={t("doNotUseWarning")}>
      <span role="img" aria-label={t("doNotUse")} className="inline-flex flex-none items-center">
        <Flag size={size} strokeWidth={2.25} color={DO_NOT_USE_RED} fill={DO_NOT_USE_RED} aria-hidden />
      </span>
    </HoverTip>
  );
}
