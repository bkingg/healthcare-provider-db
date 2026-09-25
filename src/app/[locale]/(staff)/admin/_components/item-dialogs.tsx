"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { addReferenceItemAction, updateReferenceItemAction } from "@/app/[locale]/(staff)/admin/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import type { FieldDef, ReferenceListDef, ReferenceListKey } from "@/lib/referenceListDefs";
import type { ActionResult } from "@/lib/validation/common";
import { resolveMarkerStyle } from "@/lib/mapMarkerStyle";
import { MapIconPicker, MarkerColorPicker } from "./marker-style-fields";

type RefOptions = Partial<Record<ReferenceListKey, { id: string; label: string }[]>>;
type ReferenceItem = Record<string, unknown> & { id: string; updatedAt: Date };

function textValue(item: ReferenceItem | undefined, key: string): string | undefined {
  if (!item) return undefined;
  const v = item[key];
  return v === null || v === undefined ? undefined : String(v);
}

/** Renders one field per FieldDef entry — the same five `kind`s cover every
 * one of the ~20 reference tables (see referenceListDefs.ts), so this is the
 * one place that turns that config into actual form markup, shared by the
 * add and edit dialogs below (same reasoning as AddressFields in
 * addresses-section.tsx). */
function ReferenceItemFields({
  t,
  def,
  refOptions,
  errors,
  item,
}: {
  t: ReturnType<typeof useTranslations>;
  def: ReferenceListDef;
  refOptions: RefOptions;
  errors: Record<string, string[] | undefined>;
  item?: ReferenceItem;
}) {
  // The map-marker pickers are controlled (unlike the rest of this form) so
  // the color picker's pin preview can follow the icon picker live.
  const iconField = def.fields.find((f) => f.kind === "mapIcon");
  const colorField = def.fields.find((f) => f.kind === "color");
  const [markerDraft, setMarkerDraft] = useState<Record<string, string>>(() => ({
    ...(iconField && { [iconField.key]: textValue(item, iconField.key) ?? "" }),
    ...(colorField && { [colorField.key]: textValue(item, colorField.key) ?? "" }),
  }));
  const code = textValue(item, def.codeField.key);
  const defaultMarker = resolveMarkerStyle({ code });
  const previewMarker = resolveMarkerStyle({
    code,
    mapIcon: iconField ? markerDraft[iconField.key] : undefined,
    mapColor: colorField ? markerDraft[colorField.key] : undefined,
  });
  const setMarkerField = (key: string) => (value: string) => setMarkerDraft((d) => ({ ...d, [key]: value }));

  function renderField(field: FieldDef) {
    const label = t(`fields.${field.labelKey}`);
    switch (field.kind) {
      case "text":
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={field.key}>{label}</Label>
            <Input id={field.key} name={field.key} defaultValue={textValue(item, field.key) ?? ""} required={field.required} />
            <FieldError messages={errors[field.key]} />
          </div>
        );
      case "textarea":
        return (
          <div key={field.key} className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor={field.key}>{label}</Label>
            <Textarea id={field.key} name={field.key} rows={3} defaultValue={textValue(item, field.key) ?? ""} required={field.required} />
            <FieldError messages={errors[field.key]} />
          </div>
        );
      case "number":
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={field.key}>{label}</Label>
            <Input
              id={field.key}
              name={field.key}
              type="number"
              step={field.integer ? 1 : "any"}
              defaultValue={textValue(item, field.key) ?? ""}
              required={field.required}
            />
            <FieldError messages={errors[field.key]} />
          </div>
        );
      case "select":
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <RefSelect
              name={field.key}
              options={field.options.map((v) => ({ id: v, label: v.replaceAll("_", " ") }))}
              defaultValue={textValue(item, field.key)}
              required={field.required}
            />
            <FieldError messages={errors[field.key]} />
          </div>
        );
      case "refSelect":
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <RefSelect
              name={field.key}
              options={refOptions[field.refListKey] ?? []}
              defaultValue={textValue(item, field.key)}
              required={field.required}
              placeholder={t("none")}
            />
            <FieldError messages={errors[field.key]} />
          </div>
        );
      case "checkbox":
        return (
          <div key={field.key} className="flex items-center gap-2 self-end pb-2">
            <Checkbox id={field.key} name={field.key} defaultChecked={item ? Boolean(item[field.key]) : false} />
            <Label htmlFor={field.key}>{label}</Label>
          </div>
        );
      case "mapIcon":
        return (
          <div key={field.key} className="col-span-2 flex flex-col gap-1">
            <MapIconPicker
              name={field.key}
              label={label}
              value={markerDraft[field.key] ?? ""}
              defaultStyle={defaultMarker}
              onChange={setMarkerField(field.key)}
            />
            <FieldError messages={errors[field.key]} />
          </div>
        );
      case "color":
        return (
          <div key={field.key} className="col-span-2 flex flex-col gap-1">
            <MarkerColorPicker
              name={field.key}
              label={label}
              value={markerDraft[field.key] ?? ""}
              defaultStyle={defaultMarker}
              previewStyle={previewMarker}
              onChange={setMarkerField(field.key)}
            />
            <FieldError messages={errors[field.key]} />
          </div>
        );
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={def.codeField.key}>{t(`fields.${def.codeField.labelKey}`)}</Label>
        <Input id={def.codeField.key} name={def.codeField.key} defaultValue={textValue(item, def.codeField.key) ?? ""} required readOnly={def.editOnly && !!item} />
        <FieldError messages={errors[def.codeField.key]} />
      </div>
      {def.fields.map(renderField)}
    </>
  );
}

export function AddItemDialog({
  listKey,
  def,
  refOptions,
}: {
  listKey: ReferenceListKey;
  def: ReferenceListDef;
  refOptions: RefOptions;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addReferenceItemAction, null);
  const errors = state && !state.success ? state.errors : {};

  // Same "save & close" behavior as every other add dialog in this app
  // (see addresses-section.tsx) — dismiss once the create actually lands.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex h-7 items-center gap-[6px] border-none bg-pn-accent px-2.5 text-[11px] font-semibold text-white hover:bg-pn-accent-hover"
          >
            <Plus size={13} /> {t("addItem")}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addItem")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="listKey" value={listKey} />
          <ReferenceItemFields t={t} def={def} refOptions={refOptions} errors={errors} />
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditItemDialog({
  listKey,
  def,
  refOptions,
  item,
}: {
  listKey: ReferenceListKey;
  def: ReferenceListDef;
  refOptions: RefOptions;
  item: ReferenceItem;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateReferenceItemAction, null);
  const errors = state && !state.success ? state.errors : {};

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("editItem")}>
            <Pencil size={14} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editItem")}</DialogTitle>
        </DialogHeader>
        {/* Keyed on updatedAt so a revalidation-fed refresh of `item` while
         * the dialog is open remounts the form — same fix as EditAddressDialog. */}
        <form key={item.updatedAt.getTime()} action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="listKey" value={listKey} />
          <input type="hidden" name="id" value={item.id} />
          <ReferenceItemFields t={t} def={def} refOptions={refOptions} errors={errors} item={item} />
          <div className="col-span-2">
            <SubmitButton variant="outline">{t("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
