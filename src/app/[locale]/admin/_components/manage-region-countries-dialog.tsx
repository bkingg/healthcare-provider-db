"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setRegionCountriesAction } from "@/app/[locale]/admin/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation/common";

type CountryRow = { id: string; name: string; iso2: string; regionId: string | null };

/** Region admin's reverse-direction counterpart to the countries list's own
 * "region" refSelect field (which assigns one country to a region at a
 * time) — this bulk-assigns/unassigns every country for one region from a
 * single checklist. Selection is tracked as a controlled Set (not native
 * checkbox state) specifically so the search filter below can hide rows
 * without losing their checked state — an unmounted checkbox wouldn't
 * contribute to FormData on submit. */
export function ManageRegionCountriesDialog({ region, countries }: { region: { id: string; name: string }; countries: CountryRow[] }) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(countries.filter((c) => c.regionId === region.id).map((c) => c.id)),
  );
  const [state, formAction] = useActionState<ActionResult | null, FormData>(setRegionCountriesAction, null);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) setOpen(false);
  }

  function resetSelection() {
    setSelected(new Set(countries.filter((c) => c.regionId === region.id).map((c) => c.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q)) : countries;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          resetSelection();
        }
      }}
    >
      <DialogTrigger
        render={
          <button type="button" className="cursor-pointer text-[11.5px] font-medium text-pn-accent hover:underline">
            {t("manageCountries")}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("manageCountriesTitle", { region: region.name })}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="regionId" value={region.id} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="countryIds" value={id} />
          ))}
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("manageCountriesSearchPlaceholder")} autoComplete="off" />
          <div className="max-h-72 overflow-auto border-2 border-pn-border-muted">
            {filtered.length === 0 && <p className="px-2 py-2 text-xs text-pn-gray-3">{t("noListsFound")}</p>}
            {filtered.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 border-b border-pn-rule px-2 py-1.5 text-[12.5px] last:border-b-0 hover:bg-pn-surface-hover"
              >
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="flex-1">{c.name}</span>
                <span className="text-pn-gray-3">{c.iso2}</span>
                {c.regionId && c.regionId !== region.id && !selected.has(c.id) && (
                  <span className="text-[10px] text-pn-gray-3 uppercase">{t("inAnotherRegion")}</span>
                )}
              </label>
            ))}
          </div>
          <SubmitButton variant="outline" className="self-start">
            {t("save")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
