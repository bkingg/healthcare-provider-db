import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

// Internal English identifiers, not shown to the user — WIZARD_STEPS is also
// used by providers/new/[id]/page.tsx to compute currentStep counts, so the
// array shape stays stable; display labels come from Wizard.step* below.
export const WIZARD_STEPS = [
  { n: 1, label: "Identity & type" },
  { n: 2, label: "Names & aliases" },
  { n: 3, label: "Location & coordinates" },
  { n: 4, label: "Contacts" },
  { n: 5, label: "Clinical services" },
  { n: 6, label: "Review & activate" },
] as const;

const STEP_MESSAGE_KEYS: Record<(typeof WIZARD_STEPS)[number]["label"], string> = {
  "Identity & type": "stepIdentity",
  "Names & aliases": "stepNames",
  "Location & coordinates": "stepLocation",
  Contacts: "stepContacts",
  "Clinical services": "stepClinical",
  "Review & activate": "stepReview",
};

/** Shared chrome for the "New provider profile" wizard (mockup's `isWizard`
 * screen): step sidebar + header + footer. Content is create-then-continue,
 * not a true draft — see Phase "New provider — wizard" plan notes. Steps are
 * separate page loads via `?step=N` (URL-driven, consistent with the rest of
 * the app), not client-side-only state. */
export function WizardShell({
  currentStep,
  subtitle,
  backHref,
  continueHref,
  continueLabel,
  continueDisabled,
  continueSlot,
  sideContent,
  children,
}: {
  currentStep: number;
  subtitle: string;
  backHref?: string;
  continueHref?: string;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Overrides the default Link-based continue button — used on step 1,
   * where "continue" is a real form submit (creates the provider), not a
   * plain navigation. */
  continueSlot?: React.ReactNode;
  sideContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("Wizard");
  const resolvedContinueLabel = continueLabel ?? t("continueArrow");
  const metForCount = WIZARD_STEPS.filter((s) => s.n < currentStep).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-end justify-between border-b-2 border-pn-ink px-5 pt-3.5 pb-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{t("wizardTitle")}</h1>
          <div className="mt-1 text-xs text-pn-gray-2">{subtitle}</div>
        </div>
        <div className="text-[11px] tracking-[0.08em] text-pn-gray-3 uppercase">
          {t("stepOf", { step: currentStep, total: WIZARD_STEPS.length })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside data-r="steps" className="max-[860px]:hidden flex-none w-[236px] overflow-auto border-r-2 border-pn-ink">
          {WIZARD_STEPS.map((s) => {
            const state = s.n < currentStep ? "done" : s.n === currentStep ? "active" : "upcoming";
            const meta = state === "done" ? t("stateComplete") : state === "active" ? t("stateInProgress") : t("stateNotStarted");
            return (
              <div
                key={s.n}
                className={`flex items-center gap-2.5 border-b border-pn-rule px-3.5 py-[11px] ${
                  state === "active" ? "border-l-4 border-l-pn-accent bg-pn-surface-hover" : "border-l-4 border-l-transparent"
                }`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center text-[11px] font-bold ${
                    state === "done"
                      ? "bg-pn-ink text-white"
                      : state === "active"
                        ? "bg-pn-accent text-white"
                        : "border-2 border-pn-border-muted text-pn-gray-3"
                  }`}
                >
                  {state === "done" ? "✓" : s.n}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold">{t(STEP_MESSAGE_KEYS[s.label])}</div>
                  <div className="text-[11px] text-pn-gray-3">{meta}</div>
                </div>
              </div>
            );
          })}
        </aside>

        <div data-r="split" className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_300px] overflow-auto max-[1040px]:grid-cols-[minmax(0,1fr)]">
          <div data-r="main-col" className="min-w-0 border-r-2 border-pn-ink px-[22px] py-[18px] max-[1040px]:border-r-0">{children}</div>
          <aside data-r="side" className="px-4.5 py-[18px] max-[1040px]:border-t-2 max-[1040px]:border-pn-ink">
            {sideContent}
            <p className="mt-3.5 text-[11.5px] leading-[1.55] text-pn-gray-2">{t("activationDisclaimer")}</p>
          </aside>
        </div>
      </div>

      <div className="flex flex-none items-center justify-between border-t-2 border-pn-ink bg-pn-panel px-5 py-2.5">
        {backHref ? <Button variant="outline" render={<Link href={backHref}>{t("back")}</Link>} /> : <span />}
        <div className="flex items-center gap-2">
          <span className="mr-1.5 text-[11.5px] text-pn-gray-2">{t("stepsComplete", { count: metForCount, total: WIZARD_STEPS.length })}</span>
          {continueSlot ??
            (continueHref && !continueDisabled ? (
              <Button render={<Link href={continueHref}>{resolvedContinueLabel}</Link>} />
            ) : continueHref ? (
              <Button disabled>{resolvedContinueLabel}</Button>
            ) : null)}
        </div>
      </div>
    </div>
  );
}
