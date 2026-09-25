"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { addAddressAction, deleteAddressAction, findOrCreateCountryAction, updateAddressAction } from "@/app/[locale]/(staff)/providers/actions";
import { useCanEdit } from "@/lib/can-edit-context";
import { formatDakarDate } from "@/lib/formatDate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PnSection } from "@/components/pn-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefSelect } from "@/components/ref-select";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { InlineDeleteForm } from "@/components/inline-delete-form";
import { StatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/validation/common";
import type { ProviderProfile } from "@/data/providers";

type Options = { id: string; label: string }[];
/** Countries need `iso2` (not just id/label) so a picked address-lookup
 * result — which only knows the ISO country code, not our internal FK —
 * can be matched to a CountryRef row. */
export type CountryOption = { id: string; label: string; iso2: string };
type Address = ProviderProfile["addresses"][number];

/** Shape of one `/api/geocode/search` result once Nominatim's
 * `addressdetails=1` is parsed (see src/lib/geocode.ts's GeocodeResult) —
 * redeclared locally rather than imported since that module is
 * server-only (matches distance-filter.tsx's own local GeocodeResult). */
type AddressLookupResult = {
  label: string;
  lat: number;
  lng: number;
  line1?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryIso2?: string;
  countryName?: string;
};

const LOOKUP_DEBOUNCE_MS = 500;
const LOOKUP_MIN_QUERY_LENGTH = 3;

/** "Validated by ... on ..." stamp shown per address — set from whoever last
 * saved the record (add, or edit's "Save address") via Address.updatedBy /
 * updatedAt (see providerChildRecords.ts::addAddress / updateAddress). */
function ValidationStamp({ t, address }: { t: ReturnType<typeof useTranslations>; address: Address }) {
  const locale = useLocale();
  if (!address.updatedBy) return <span className="text-pn-gray-3">{t("notYetValidated")}</span>;
  return (
    <span className="text-pn-gray-2">
      {t("validatedBy", { name: address.updatedBy.name ?? address.updatedBy.email, date: formatDakarDate(address.updatedAt, locale) })}
    </span>
  );
}

/** Pasting a "lat, lon" pair (e.g. from Google Maps) into the latitude field
 * splits it across both fields instead of dropping the whole string in. */
function handleLatitudePaste(e: React.ClipboardEvent<HTMLInputElement>, longitudeInput: HTMLInputElement | null) {
  const text = e.clipboardData.getData("text");
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match || !longitudeInput) return;
  e.preventDefault();
  e.currentTarget.value = match[1];
  longitudeInput.value = match[2];
}

/** Address search typeahead (OpenStreetMap/Nominatim via
 * /api/geocode/search, same as the map's "Distance from point" filter in
 * distance-filter.tsx) that autofills the fields below from the picked
 * result's parsed address components instead of staff retyping
 * City/State/Postal/Country by hand. Line1/City/State/Postal are plain
 * uncontrolled inputs (read via FormData on submit, like the rest of this
 * form) so a pick writes to them imperatively through refs — same technique
 * the existing lat/lon paste-split handler already uses for longitudeRef.
 * Country has to be a controlled RefSelect instead, since there's no ref
 * escape hatch for setting a Base UI Select's value from outside an event.
 *
 * If the picked result's country isn't in `countries` at all (this app's
 * CountryRef list is curated, not the full ISO list), it's provisioned on
 * the fly via findOrCreateCountryAction — matched/created by iso2 server-side,
 * so picking the same new country from two different address forms (or an
 * admin having already added it by hand) can't create a duplicate row. */
function AddressLookup({
  t,
  countries,
  line1Ref,
  cityRef,
  stateProvinceRef,
  postalCodeRef,
  latitudeRef,
  longitudeRef,
  onCountryMatch,
  onCountryCreated,
}: {
  t: ReturnType<typeof useTranslations>;
  countries: CountryOption[];
  line1Ref: React.RefObject<HTMLInputElement | null>;
  cityRef: React.RefObject<HTMLInputElement | null>;
  stateProvinceRef: React.RefObject<HTMLInputElement | null>;
  postalCodeRef: React.RefObject<HTMLInputElement | null>;
  latitudeRef: React.RefObject<HTMLInputElement | null>;
  longitudeRef: React.RefObject<HTMLInputElement | null>;
  onCountryMatch: (countryId: string) => void;
  onCountryCreated: (country: CountryOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressLookupResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provisioningCountry, setProvisioningCountry] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const queryTooShort = query.trim().length < LOOKUP_MIN_QUERY_LENGTH;

  useEffect(() => {
    if (queryTooShort) return;
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data: { results: AddressLookupResult[] } = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // Aborted by a newer keystroke, or a network hiccup — the next
        // keystroke naturally retries; not worth surfacing an error for this.
      } finally {
        setLoading(false);
      }
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, queryTooShort]);

  // Derived, not stored: avoids a synchronous setState in the effect above
  // just to clear stale results once the query drops below the minimum
  // length (same pattern as DistanceFilter's visibleResults).
  const visibleResults = queryTooShort ? [] : results;

  async function applyResult(r: AddressLookupResult) {
    if (r.line1 && line1Ref.current) line1Ref.current.value = r.line1;
    if (r.city && cityRef.current) cityRef.current.value = r.city;
    if (r.stateProvince && stateProvinceRef.current) stateProvinceRef.current.value = r.stateProvince;
    if (r.postalCode && postalCodeRef.current) postalCodeRef.current.value = r.postalCode;
    if (latitudeRef.current) latitudeRef.current.value = String(r.lat);
    if (longitudeRef.current) longitudeRef.current.value = String(r.lng);
    setQuery(r.label);
    setResults([]);
    setOpen(false);

    if (!r.countryIso2) return;
    const match = countries.find((c) => c.iso2 === r.countryIso2);
    if (match) {
      onCountryMatch(match.id);
      return;
    }
    if (!r.countryName) return; // no name to create it with — leave Country for the user to set
    setProvisioningCountry(r.countryName);
    try {
      const created = await findOrCreateCountryAction(r.countryIso2, r.countryName);
      onCountryCreated(created);
      onCountryMatch(created.id);
    } catch {
      // Best-effort — the user can still pick/add the country manually via
      // this field or the Admin Value Lists screen.
    } finally {
      setProvisioningCountry(null);
    }
  }

  return (
    <div ref={containerRef} className="relative col-span-2 flex flex-col gap-1.5">
      <Label htmlFor="addressLookup">{t("addressLookup")}</Label>
      <Input
        id="addressLookup"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => visibleResults.length > 0 && setOpen(true)}
        placeholder={t("addressLookupPlaceholder")}
        autoComplete="off"
      />
      {open && (loading || visibleResults.length > 0) && (
        <div className="absolute top-full left-0 z-10 mt-1 max-h-52 w-full overflow-auto border-2 border-pn-ink bg-white">
          {loading && <div className="px-2 py-1.5 text-xs text-pn-gray-3">{t("addressLookupSearching")}</div>}
          {!loading && visibleResults.length === 0 && <div className="px-2 py-1.5 text-xs text-pn-gray-3">{t("addressLookupNoResults")}</div>}
          {!loading &&
            visibleResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void applyResult(r)}
                className="block w-full cursor-pointer border-b border-pn-rule px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-pn-surface-hover"
              >
                {r.label}
              </button>
            ))}
        </div>
      )}
      <p className="text-xs text-pn-gray-3">
        {provisioningCountry ? t("addressLookupAddingCountry", { country: provisioningCountry }) : t("addressLookupHint")}
      </p>
    </div>
  );
}

/** Shared by both the "Add" form below and this dialog's "Edit" form —
 * same field set either way, since editing an address supports the exact
 * same geocode-if-missing fallback as creating one (see
 * providerChildRecords.ts::updateAddress). */
function AddressFields({ t, addressTypes, countries, errors, defaults }: {
  t: ReturnType<typeof useTranslations>;
  addressTypes: Options;
  countries: CountryOption[];
  errors: Record<string, string[] | undefined>;
  defaults?: Address;
}) {
  const line1Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateProvinceRef = useRef<HTMLInputElement>(null);
  const postalCodeRef = useRef<HTMLInputElement>(null);
  const latitudeRef = useRef<HTMLInputElement>(null);
  const longitudeRef = useRef<HTMLInputElement>(null);
  // Always a defined string (never `undefined`), even with no default — Base
  // UI's Select decides controlled-vs-uncontrolled once, on its first render,
  // from whether `value` is `undefined` (see @base-ui/utils/useControlled).
  // Starting this at `undefined` on the Add dialog would lock the Select into
  // uncontrolled mode, so a later setCountryId() from a picked address-lookup
  // result would silently do nothing. "" is treated the same as "no
  // selection" (falls back to the placeholder) since it doesn't match any
  // option's id.
  const [countryId, setCountryId] = useState(defaults?.countryId ?? "");
  // Seeded from the `countries` prop, then appended to locally whenever the
  // lookup provisions a new country — so it shows up as a selectable (and
  // already-selected) option immediately, without waiting on the server
  // component that fetched `countries` to re-render.
  const [countryOptions, setCountryOptions] = useState(countries);

  return (
    <>
      <AddressLookup
        t={t}
        countries={countryOptions}
        line1Ref={line1Ref}
        cityRef={cityRef}
        stateProvinceRef={stateProvinceRef}
        postalCodeRef={postalCodeRef}
        latitudeRef={latitudeRef}
        longitudeRef={longitudeRef}
        onCountryMatch={setCountryId}
        onCountryCreated={(country) => setCountryOptions((prev) => (prev.some((c) => c.id === country.id) ? prev : [...prev, country]))}
      />
      <div className="flex flex-col gap-1.5">
        <Label>{t("formType")}</Label>
        <RefSelect name="addressTypeId" options={addressTypes} defaultValue={defaults?.addressTypeId} required />
        <FieldError messages={errors.addressTypeId} />
      </div>
      <div className="flex items-center gap-2 self-end pb-2">
        <Checkbox id="isPrimary" name="isPrimary" defaultChecked={defaults?.isPrimary} />
        <Label htmlFor="isPrimary">{t("formPrimary")}</Label>
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="line1">{t("line1")}</Label>
        <Input ref={line1Ref} id="line1" name="line1" defaultValue={defaults?.line1} required />
        <FieldError messages={errors.line1} />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="line2">{t("line2")}</Label>
        <Input id="line2" name="line2" defaultValue={defaults?.line2 ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="city">{t("city")}</Label>
        <Input ref={cityRef} id="city" name="city" defaultValue={defaults?.city} required />
        <FieldError messages={errors.city} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stateProvince">{t("stateProvince")}</Label>
        <Input ref={stateProvinceRef} id="stateProvince" name="stateProvince" defaultValue={defaults?.stateProvince ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="postalCode">{t("postalCode")}</Label>
        <Input ref={postalCodeRef} id="postalCode" name="postalCode" defaultValue={defaults?.postalCode ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("country")}</Label>
        <RefSelect name="countryId" options={countryOptions} value={countryId} onValueChange={setCountryId} required />
        <FieldError messages={errors.countryId} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="latitude">{t("latitude")}</Label>
        <Input
          ref={latitudeRef}
          id="latitude"
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          defaultValue={defaults?.latitude ?? ""}
          onPaste={(e) => handleLatitudePaste(e, longitudeRef.current)}
        />
        <FieldError messages={errors.latitude} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="longitude">{t("longitude")}</Label>
        <Input ref={longitudeRef} id="longitude" name="longitude" type="number" step="any" min={-180} max={180} defaultValue={defaults?.longitude ?? ""} />
        <FieldError messages={errors.longitude} />
      </div>
      <p className="col-span-2 text-xs text-pn-gray-3">{t("geocodeHint")}</p>
    </>
  );
}

function EditAddressDialog({ address, providerId, addressTypes, countries }: {
  address: Address;
  providerId: string;
  addressTypes: Options;
  countries: CountryOption[];
}) {
  const t = useTranslations("Sections.Addresses");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateAddressAction, null);
  // "Clear form" blanks every field (defaults dropped, form remounted) and
  // hides stale validation errors from the last submit. Scoped to the
  // address version / action result it was pressed against, so a later save
  // (fresh updatedAt) or resubmit shows real data and errors again.
  const [clearedFor, setClearedFor] = useState<{ updatedAt: number; state: typeof state } | null>(null);
  const [clearNonce, setClearNonce] = useState(0);
  const cleared = clearedFor?.updatedAt === address.updatedAt.getTime();
  const errors = state && !state.success && !(cleared && clearedFor.state === state) ? state.errors : {};

  // "Save address" doubles as "Save & Close" — once the update succeeds,
  // dismiss the dialog instead of leaving it open on the just-saved form.
  // Adjusting state during render (rather than in an effect) per
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
        {/* Keyed on updatedAt: after a save, revalidation feeds this same
         * mounted dialog fresh `address` data while it may still be open —
         * without a remount, the RefSelects' uncontrolled defaultValue would
         * go stale (same class of bug fixed in provider-header.tsx's edit
         * dialog). */}
        <form key={`${address.updatedAt.getTime()}-${clearNonce}`} action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={address.id} />
          <input type="hidden" name="providerId" value={providerId} />
          <AddressFields t={t} addressTypes={addressTypes} countries={countries} errors={errors} defaults={cleared ? undefined : address} />
          <div className="col-span-2 flex items-center gap-2">
            <SubmitButton>{t("save")}</SubmitButton>
            <Button
              type="button"
              className="ml-auto bg-destructive text-white hover:bg-destructive/85"
              onClick={() => {
                setClearedFor({ updatedAt: address.updatedAt.getTime(), state });
                setClearNonce((n) => n + 1);
              }}
            >
              {t("clear")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAddressDialog({ providerId, addressTypes, countries }: {
  providerId: string;
  addressTypes: Options;
  countries: CountryOption[];
}) {
  const t = useTranslations("Sections.Addresses");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addAddressAction, null);
  // Clearing remounts the form (dropping the lookup query, country and
  // type selections along with the text inputs) and hides stale errors.
  const [clearNonce, setClearNonce] = useState(0);
  const [clearedState, setClearedState] = useState<typeof state | undefined>(undefined);
  const errors = state && !state.success && clearedState !== state ? state.errors : {};

  // Same "save & close" behavior as the edit dialog — successful adds
  // dismiss the popup instead of leaving an already-submitted form open.
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
            <Plus size={13} /> {t("add")}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
        </DialogHeader>
        <form key={clearNonce} action={formAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="providerId" value={providerId} />
          <AddressFields t={t} addressTypes={addressTypes} countries={countries} errors={errors} />
          <div className="col-span-2 flex items-center gap-2">
            <SubmitButton>{t("add")}</SubmitButton>
            <Button
              type="button"
              className="ml-auto bg-destructive text-white hover:bg-destructive/85"
              onClick={() => {
                setClearedState(state);
                setClearNonce((n) => n + 1);
              }}
            >
              {t("clear")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddressesSection({
  provider,
  addressTypes,
  countries,
}: {
  provider: ProviderProfile;
  addressTypes: Options;
  countries: CountryOption[];
}) {
  const t = useTranslations("Sections.Addresses");
  const canEdit = useCanEdit();

  return (
    <PnSection
      title={t("title")}
      action={canEdit ? <AddAddressDialog providerId={provider.id} addressTypes={addressTypes} countries={countries} /> : undefined}
      className="flex flex-col gap-4"
    >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colAddress")}</TableHead>
              <TableHead>{t("colCityCountry")}</TableHead>
              <TableHead>{t("colCoordinates")}</TableHead>
              <TableHead>{t("colValidated")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {provider.addresses.map((address) => (
              <TableRow key={address.id}>
                <TableCell>
                  {address.addressType.name} {address.isPrimary && <Badge variant="outline">{t("badgePrimary")}</Badge>}
                </TableCell>
                <TableCell>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                </TableCell>
                <TableCell>
                  {address.city}, {address.country.name}
                </TableCell>
                <TableCell>
                  <StatusBadge status={address.coordinateStatus} />
                </TableCell>
                <TableCell className="text-xs">
                  <ValidationStamp t={t} address={address} />
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <EditAddressDialog address={address} providerId={provider.id} addressTypes={addressTypes} countries={countries} />
                      <InlineDeleteForm action={deleteAddressAction} hiddenFields={{ id: address.id, providerId: provider.id }} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PnSection>
  );
}
