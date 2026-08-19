import { useTranslations } from "next-intl";

/** Mockup's `mkField` label row: uppercase label + accent "required" tag. */
export function WizardFieldLabel({ label, required }: { label: string; required?: boolean }) {
  const t = useTranslations("Common");
  return (
    <span className="mb-1 flex gap-1.5 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
      {label}
      {required && <span className="font-bold text-pn-accent">{t("required")}</span>}
    </span>
  );
}
