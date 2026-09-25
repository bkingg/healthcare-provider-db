"use client";

import { useState } from "react";
import { RefSelect } from "@/components/ref-select";
import { Input } from "@/components/ui/input";
import { countryCallingCode, formatPhoneInput, phoneCountries, reformatForCountry } from "@/lib/phone";

const COUNTRY_TRIGGER_CLASS =
  "flex h-[30px] w-[92px] flex-none items-center justify-between gap-1.5 truncate rounded-none border-2 border-pn-border-muted bg-white px-2 font-[inherit] text-[12.5px] text-pn-ink shadow-none outline-none data-placeholder:text-pn-gray-3 hover:border-pn-ink hover:bg-white focus-visible:border-pn-ink focus-visible:ring-0 active:border-pn-ink data-open:border-pn-ink";

const COUNTRY_OPTIONS = phoneCountries().map((c) => ({ id: c.iso2, label: `${c.name} (+${c.callingCode})` }));

/** Phone number field paired with an ad hoc "country code" picker. Defaults
 * to the provider's own country — so the dial code doesn't have to be known
 * or typed — but the picker lets it be swapped for any other country (e.g. a
 * US-based answering service fielding calls for a Senegalese clinic); the
 * number reformats and re-truncates to the newly selected country's standard
 * grouping on every change (see src/lib/phone.ts). Shared by the Phones
 * panel and the Administrative contacts panel's phone field.
 *
 * Fully controlled — unlike the defaultValue-and-a-ref pattern most fields in
 * these forms use — because picking a country needs to rewrite the number
 * field's current value, not just format future keystrokes. The caller
 * remounts this component (via `key`, e.g. tied to the list's length) after
 * a successful add so it resets back to the provider's own country for the
 * next entry, the same remount-on-data-change convention already used for
 * EditProviderForm and the AddressesSection's uncontrolled fields. */
export function PhoneNumberField({
  name,
  defaultCountryIso2,
  placeholder,
  required,
}: {
  name: string;
  defaultCountryIso2: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [iso2, setIso2] = useState(defaultCountryIso2);
  const [value, setValue] = useState(() => {
    const code = countryCallingCode(defaultCountryIso2);
    return code ? `${code} ` : "";
  });

  return (
    <div className="flex gap-2">
      <RefSelect
        name={`${name}Country`}
        options={COUNTRY_OPTIONS}
        value={iso2}
        onValueChange={(next) => {
          setValue((current) => reformatForCountry(current, iso2, next));
          setIso2(next);
        }}
        triggerClassName={COUNTRY_TRIGGER_CLASS}
      />
      <Input
        name={name}
        value={value}
        onChange={(e) => setValue(formatPhoneInput(e.target.value, iso2))}
        placeholder={placeholder}
        required={required}
        className="flex-1"
      />
    </div>
  );
}
