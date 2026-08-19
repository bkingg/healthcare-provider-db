"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  addAffiliationAction,
  deleteAffiliationAction,
  searchAffiliationCandidatesAction,
  updateAffiliationAction,
} from "@/app/[locale]/providers/actions";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCanEdit } from "@/lib/can-edit-context";
import { ProviderStatus } from "@/lib/enums";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

type Candidate = {
  id: string;
  providerCode: string;
  name: string;
  type: string | null;
  city: string | null;
  country: string | null;
  status: string;
};

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_QUERY_LENGTH = 2;

/** Replaces what used to be a plain `<select>` of every provider in the
 * system (see the removed listProviderSummaries in data/providers.ts — its
 * own comment already called out that a 200-row dropdown was a UX dead end
 * and a server-searched combobox was the real fix). Name alone is ambiguous
 * in this dataset (repeated facility names across different cities), so
 * each result line also shows type, city/country, the short "PROVIDERID"
 * shown throughout the rest of the UI, and a status badge when the match
 * isn't ACTIVE — enough to be confident you're tagging the right record
 * without opening it in another tab first. */
function RelatedProviderSearch({ providerId, error }: { providerId: string; error?: string[] }) {
  const t = useTranslations("Sections.Affiliations");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const queryTooShort = query.trim().length < SEARCH_MIN_QUERY_LENGTH || query === selected?.name;

  useEffect(() => {
    if (queryTooShort) return;
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const candidates = await searchAffiliationCandidatesAction(query, providerId);
        if (!controller.signal.aborted) {
          setResults(candidates);
          setOpen(true);
        }
      } catch {
        // Network hiccup — the next keystroke naturally retries.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, queryTooShort, providerId]);

  // Derived, not stored: avoids a synchronous setState in the effect above
  // just to clear stale results once the query drops below the minimum
  // length (same pattern as DistanceFilter's visibleResults).
  const visibleResults = queryTooShort ? [] : results;

  function selectCandidate(c: Candidate) {
    setSelected(c);
    setQuery(c.name);
    setResults([]);
    setOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="relatedProviderSearch">{t("formRelatedProvider")}</Label>
      <input type="hidden" name="relatedProviderId" value={selected?.id ?? ""} />
      <div ref={containerRef} className="relative">
        <Input
          id="relatedProviderSearch"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) setSelected(null);
          }}
          onFocus={() => visibleResults.length > 0 && setOpen(true)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
        />
        {selected && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label={t("clearSelection")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer text-sm leading-none text-pn-gray-3 hover:text-pn-ink"
          >
            ×
          </button>
        )}
        {open && (
          <div className="absolute top-full left-0 z-10 mt-1 max-h-64 w-full overflow-auto border-2 border-pn-ink bg-white">
            {loading && <div className="px-2 py-1.5 text-xs text-pn-gray-3">{t("searching")}</div>}
            {!loading && visibleResults.length === 0 && <div className="px-2 py-1.5 text-xs text-pn-gray-3">{t("noResults")}</div>}
            {!loading &&
              visibleResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCandidate(c)}
                  className="flex w-full cursor-pointer flex-col gap-0.5 border-b border-pn-rule px-2 py-1.5 text-left last:border-b-0 hover:bg-pn-surface-hover"
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-pn-ink">
                    {c.name}
                    {c.status !== ProviderStatus.ACTIVE && <StatusBadge status={c.status} />}
                  </span>
                  <span className="text-[11px] text-pn-gray-3">
                    {[c.type, [c.city, c.country].filter(Boolean).join(", "), c.providerCode].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
      <FieldError messages={error} />
    </div>
  );
}

/** Changes just the relationship type ("the affiliation tag") on an
 * existing row — manageable from either provider's profile, since deleting
 * and re-adding to change a typo'd type would also orphan the audit trail
 * for no reason. Who's related to whom isn't editable here; that's the
 * affiliation's identity (see updateAffiliationSchema's comment). */
function EditAffiliationDialog({
  affiliationId,
  affiliationTypeId,
  affiliationTypes,
  providerId,
}: {
  affiliationId: string;
  affiliationTypeId: string;
  affiliationTypes: { id: string; label: string }[];
  providerId: string;
}) {
  const t = useTranslations("Sections.Affiliations");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateAffiliationAction, null);
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
          <button type="button" className="cursor-pointer text-pn-gray-2 hover:text-pn-ink" aria-label={t("edit")}>
            <Pencil size={14} />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={affiliationId} />
          <input type="hidden" name="providerId" value={providerId} />
          <div className="flex flex-col gap-1.5">
            <Label>{t("formRelationshipType")}</Label>
            <RefSelect name="affiliationTypeId" options={affiliationTypes} defaultValue={affiliationTypeId} required />
            <FieldError messages={errors.affiliationTypeId} />
          </div>
          <SubmitButton variant="outline" className="self-start">
            {t("save")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AffiliationsSection({
  provider,
  affiliationTypes,
}: {
  provider: ProviderProfile;
  affiliationTypes: { id: string; label: string }[];
}) {
  const t = useTranslations("Sections.Affiliations");
  const canEdit = useCanEdit();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addAffiliationAction, null);
  const errors = state && !state.success ? state.errors : {};

  // Every row is manageable from here regardless of which side of the
  // relationship this provider is on — the "you can only delete/edit from
  // the side that created it" restriction this replaced meant a hospital
  // couldn't remove or retag a physician's own self-reported affiliation to
  // it, which is exactly the case this section exists to handle.
  const rows = [
    ...provider.affiliationsAsSubject.map((a) => ({
      id: a.id,
      affiliationTypeId: a.affiliationTypeId,
      type: a.affiliationType.name,
      other: a.relatedProvider.names[0]?.fullNameText ?? a.relatedProviderId,
      otherId: a.relatedProviderId,
    })),
    ...provider.affiliationsAsRelated.map((a) => ({
      id: a.id,
      affiliationTypeId: a.affiliationTypeId,
      type: `${a.affiliationType.name}${t("ofSuffix")}`,
      other: a.provider.names[0]?.fullNameText ?? a.providerId,
      otherId: a.providerId,
    })),
  ];

  return (
    <PnSection title={t("title")} className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colRelatedProvider")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.type}</TableCell>
                <TableCell>
                  <Link href={`/providers/${row.otherId}`} className="hover:underline">
                    {row.other}
                  </Link>
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <EditAffiliationDialog
                        affiliationId={row.id}
                        affiliationTypeId={row.affiliationTypeId}
                        affiliationTypes={affiliationTypes}
                        providerId={provider.id}
                      />
                      <InlineDeleteForm action={deleteAffiliationAction} hiddenFields={{ id: row.id, providerId: provider.id }} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t("noAffiliations")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {canEdit && (
          <form action={formAction} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="providerId" value={provider.id} />
            <RelatedProviderSearch providerId={provider.id} error={errors.relatedProviderId} />
            <div className="flex flex-col gap-1.5">
              <Label>{t("formRelationshipType")}</Label>
              <RefSelect name="affiliationTypeId" options={affiliationTypes} required />
              <FieldError messages={errors.affiliationTypeId} />
            </div>
            <div className="col-span-2">
              <SubmitButton variant="outline">{t("add")}</SubmitButton>
            </div>
          </form>
        )}
      </PnSection>
  );
}
