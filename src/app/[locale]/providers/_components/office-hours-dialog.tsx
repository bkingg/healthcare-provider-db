"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2Icon } from "lucide-react";
import { addOfficeHoursBatchAction } from "@/app/[locale]/providers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefSelect } from "@/components/ref-select";
import { SubmitButton } from "@/components/submit-button";
import { FieldError } from "@/components/field-error";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DayOfWeek } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";

// Internal English identifiers as Record keys, translated for display —
// same convention as ProfileTab's TAB_MESSAGE_KEYS in provider-header.tsx.
// Also used by taxonomy-section.tsx to label already-saved entries.
export const DAY_MESSAGE_KEYS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: "dayMonday",
  [DayOfWeek.TUESDAY]: "dayTuesday",
  [DayOfWeek.WEDNESDAY]: "dayWednesday",
  [DayOfWeek.THURSDAY]: "dayThursday",
  [DayOfWeek.FRIDAY]: "dayFriday",
  [DayOfWeek.SATURDAY]: "daySaturday",
  [DayOfWeek.SUNDAY]: "daySunday",
};

/** Mon-Fri 9-to-5 plus a Saturday half-day — the common outpatient-clinic
 * pattern, prefilled so posting a typical week is "delete the days that
 * don't apply" rather than six from-scratch entries. */
const DEFAULT_TEMPLATE: { dayOfWeek: DayOfWeek; openTime: string; closeTime: string }[] = [
  { dayOfWeek: DayOfWeek.MONDAY, openTime: "08:00", closeTime: "17:00" },
  { dayOfWeek: DayOfWeek.TUESDAY, openTime: "08:00", closeTime: "17:00" },
  { dayOfWeek: DayOfWeek.WEDNESDAY, openTime: "08:00", closeTime: "17:00" },
  { dayOfWeek: DayOfWeek.THURSDAY, openTime: "08:00", closeTime: "17:00" },
  { dayOfWeek: DayOfWeek.FRIDAY, openTime: "08:00", closeTime: "17:00" },
  { dayOfWeek: DayOfWeek.SATURDAY, openTime: "08:00", closeTime: "12:00" },
];

type Row = { key: number; dayOfWeek: DayOfWeek; openTime: string; closeTime: string };

function templateRows(): Row[] {
  return DEFAULT_TEMPLATE.map((entry, i) => ({ key: i, ...entry }));
}

/** "Add office hours" — opens prefilled with a default Mon-Sat week (see
 * DEFAULT_TEMPLATE) so the common case is deleting the rows that don't apply
 * and adjusting times, not building a schedule from six blank rows. Rows are
 * plain uncontrolled `<input>`/RefSelect (defaultValue), same as every other
 * add-form in this app — only *which rows exist* is React state, so
 * add/remove-row doesn't need to fight controlled inputs for the values the
 * user is actively editing. Submits every remaining row in one action
 * (addOfficeHoursBatchAction) and closes itself on success. */
export function OfficeHoursDialog({ providerId }: { providerId: string }) {
  const t = useTranslations("Taxonomy");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(templateRows);
  const nextKey = useRef(DEFAULT_TEMPLATE.length);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addOfficeHoursBatchAction, null);
  const errors = state && !state.success ? state.errors : {};
  const dayOptions = Object.values(DayOfWeek).map((day) => ({ id: day, label: t(DAY_MESSAGE_KEYS[day]) }));

  // Closes the dialog once the batch is actually saved — an "add" action
  // like this one is a single one-shot creation, not a persistent edit
  // surface (unlike the Edit profile / Change status dialogs elsewhere on
  // this page, which stay open after saving). Adjusted during render
  // (React's documented pattern for reacting to a prop/state change) rather
  // than in an effect, guarded by handledState so it only fires once per new
  // action result instead of on every render.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) setOpen(false);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey.current++, dayOfWeek: DayOfWeek.MONDAY, openTime: "08:00", closeTime: "17:00" }]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopening always starts from the default template, not wherever
        // the user last left the row list (including empty).
        if (next) {
          setRows(templateRows());
          nextKey.current = DEFAULT_TEMPLATE.length;
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm">{t("addOfficeHours")}</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("officeHours")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="providerId" value={providerId} />
          <p className="text-xs text-muted-foreground">{t("officeHoursTemplateHint")}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noOfficeHours")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("day")}</TableHead>
                  <TableHead>{t("openTime")}</TableHead>
                  <TableHead>{t("closeTime")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <RefSelect name="dayOfWeek" options={dayOptions} defaultValue={row.dayOfWeek} />
                    </TableCell>
                    <TableCell>
                      <Input name="openTime" type="time" defaultValue={row.openTime} required />
                    </TableCell>
                    <TableCell>
                      <Input name="closeTime" type="time" defaultValue={row.closeTime} required />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("removeDay")} onClick={() => removeRow(row.key)}>
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <FieldError messages={errors.dayOfWeek ?? errors.openTime ?? errors.closeTime} />
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={addRow}>
            <Plus size={14} /> {t("addAnotherDay")}
          </Button>
          <SubmitButton className="self-start">{t("saveOfficeHours")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
