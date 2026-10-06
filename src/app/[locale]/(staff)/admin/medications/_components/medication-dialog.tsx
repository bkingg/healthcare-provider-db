"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { REGULATORY_CLASSES, type RegulatoryClass } from "@/lib/medications";
import type { ActionResult } from "@/lib/validation/common";
import { saveMedicationAction } from "../actions";

export type MedicationValues = {
  id?: string;
  code: string;
  dci: string;
  brandName: string;
  strength: string;
  form: string;
  presentation: string;
  therapeuticClass: string;
  regulatoryClass: RegulatoryClass;
  isPsychotropic: boolean;
  isColdChain: boolean;
  prescriptionRequired: boolean;
  source: string;
};

const EMPTY: MedicationValues = {
  code: "", dci: "", brandName: "", strength: "", form: "", presentation: "", therapeuticClass: "",
  regulatoryClass: "NOT_LISTED", isPsychotropic: false, isColdChain: false, prescriptionRequired: false, source: "",
};

/** Add or edit one catalog item. Controlled fields, so a failed save keeps
 * what was typed. Listed classes always require a prescription. */
export function MedicationDialog({ mode, values = EMPTY }: { mode: "create" | "edit"; values?: MedicationValues }) {
  const t = useTranslations("MedicationCatalog");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(values);
  const [state, action] = useActionState<ActionResult | null, FormData>(saveMedicationAction, null);
  const errors = state && !state.success ? state.errors : {};
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    if (state?.success) {
      setOpen(false);
      if (mode === "create") setV(EMPTY);
    }
  }
  const listed = v.regulatoryClass !== "NOT_LISTED";
  const input = "h-8 border-2 border-pn-border-muted bg-white px-2 text-[13px] outline-none focus:border-pn-ink";
  const field = (key: keyof MedicationValues, required = false, extra = "") => (
    <label className={`flex flex-col gap-1 text-[11px] font-semibold text-pn-gray-1 ${extra}`}>
      {t(`field.${key}`)}
      <input name={key} required={required} value={String(v[key])} onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))} className={input} />
      <FieldError messages={errors[key]} />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <button type="button" className="flex h-8 cursor-pointer items-center gap-[7px] border-none bg-pn-accent px-3 text-xs font-semibold text-white hover:bg-pn-accent-hover">
              <Plus size={14} /> {t("add")}
            </button>
          ) : (
            <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("edit")} title={t("edit")}>
              <Pencil size={14} />
            </button>
          )
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("add") : t("editTitle", { code: values.code })}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {v.id && <input type="hidden" name="id" value={v.id} />}
          {field("dci", true)}
          {field("strength")}
          {field("form", true)}
          {field("brandName")}
          {field("presentation")}
          {field("code", true)}
          {field("therapeuticClass", false, "sm:col-span-2")}
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-pn-gray-1">
            {t("regulatoryClass")}
            <select name="regulatoryClass" value={v.regulatoryClass} onChange={(e) => setV((p) => ({ ...p, regulatoryClass: e.target.value as RegulatoryClass }))} className={input}>
              {REGULATORY_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {t(`class.${c}`)}
                </option>
              ))}
            </select>
          </label>
          {field("source")}
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            {(["prescriptionRequired", "isPsychotropic", "isColdChain"] as const).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                <input
                  type="checkbox"
                  name={k}
                  value="1"
                  checked={k === "prescriptionRequired" ? listed || v[k] : v[k]}
                  disabled={k === "prescriptionRequired" && listed}
                  onChange={(e) => setV((p) => ({ ...p, [k]: e.target.checked }))}
                  className="h-4 w-4 accent-pn-ink"
                />
                {t(`field.${k}`)}
              </label>
            ))}
          </div>
          {listed && <p className="m-0 text-[11.5px] text-pn-gray-2 sm:col-span-2">{t("listedNeedsRx")}</p>}
          <div className="sm:col-span-2">
            <SubmitButton>{t("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
