"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, LocateFixed } from "lucide-react";
import type { ActionResult } from "@/lib/validation/common";
import { createRequestAction } from "../../actions";

type Person = { id: string; name: string; detail: string };
type Category = { id: string; code: string; label: string };

const URGENCIES = ["EMERGENCY", "TODAY", "THIS_WEEK", "ROUTINE"] as const;

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-3 flex items-center gap-2 p-0 text-[17px] font-bold">
        <span className="flex h-7 w-7 items-center justify-center bg-pn-ink text-[14px] text-white">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** A choice rendered as a large tappable card over a real radio input, so
 * it works with the keyboard and screen readers and submits with the form. */
function ChoiceCard({ name, value, checked, onChange, children, tone }: { name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode; tone?: "danger" }) {
  const on = tone === "danger" ? "border-[#b91c1c] bg-[#fdf2f2]" : "border-pn-ink bg-pn-accent-soft";
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 border-2 px-4 py-3 ${checked ? on : "border-pn-border-muted bg-white"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" required />
      <span className={`flex h-5 w-5 flex-none items-center justify-center border-2 ${checked ? "border-pn-ink bg-pn-ink text-white" : "border-pn-border-muted"}`} aria-hidden>
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-col">{children}</span>
    </label>
  );
}

export function RequestForm({
  people,
  categories,
  emergencyPanel,
  defaultPhone,
  primaryAddress,
}: {
  people: Person[];
  categories: Category[];
  emergencyPanel: React.ReactNode;
  defaultPhone: string;
  /** Pre-fills where the member is; they can change it. */
  primaryAddress: { addressText: string; latitude: number | null; longitude: number | null } | null;
}) {
  const t = useTranslations("MemberApp");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createRequestAction, null);
  const errors = state && !state.success ? state.errors : {};

  const [patientId, setPatientId] = useState(people.length === 1 ? people[0].id : "");
  const [categoryId, setCategoryId] = useState("");
  const [urgency, setUrgency] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    primaryAddress?.latitude != null && primaryAddress.longitude != null ? { lat: primaryAddress.latitude, lng: primaryAddress.longitude } : null,
  );
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  // Text fields are controlled too, not just the choices above: React resets
  // a form's uncontrolled fields after every submission, which would wipe
  // what the member typed whenever the server sends back an error.
  const [description, setDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState(primaryAddress?.addressText ?? "");
  const [contactPhone, setContactPhone] = useState(defaultPhone);
  const [hasWhatsapp, setHasWhatsapp] = useState(false);

  function useMyLocation() {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  const fieldError = (key: string) => errors[key]?.[0];

  return (
    <form action={action} className="flex flex-col gap-8 px-4 py-6">
      <Section n={1} title={t("whoNeedsHelp")}>
        {people.map((p) => (
          <ChoiceCard key={p.id} name="patientId" value={p.id} checked={patientId === p.id} onChange={() => setPatientId(p.id)}>
            <span className="text-[16px] font-semibold">{p.name}</span>
            {p.detail && <span className="text-[13px] text-pn-gray-2">{p.detail}</span>}
          </ChoiceCard>
        ))}
        {fieldError("patientId") && <p className="m-0 text-[14px] text-[#b91c1c]">{t("choosePerson")}</p>}
      </Section>

      <Section n={2} title={t("whatDoYouNeed")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <ChoiceCard key={c.id} name="categoryId" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)}>
              <span className="text-[15px] font-semibold">{c.label}</span>
            </ChoiceCard>
          ))}
        </div>
        {fieldError("categoryId") && <p className="m-0 text-[14px] text-[#b91c1c]">{t("chooseCategory")}</p>}

        <p className="m-0 mt-2 text-[15px] font-semibold">{t("howUrgent")}</p>
        {URGENCIES.map((u) => (
          <ChoiceCard key={u} name="urgency" value={u} checked={urgency === u} onChange={() => setUrgency(u)} tone={u === "EMERGENCY" ? "danger" : undefined}>
            <span className={`text-[15px] font-semibold ${u === "EMERGENCY" ? "text-[#991b1b]" : ""}`}>{t(`urgency.${u}`)}</span>
            <span className="text-[13px] text-pn-gray-2">{t(`urgencyHelp.${u}`)}</span>
          </ChoiceCard>
        ))}
        {fieldError("urgency") && <p className="m-0 text-[14px] text-[#b91c1c]">{t("chooseUrgency")}</p>}
        {/* Life-threatening: the numbers come first, before anything else is
         * asked. The request can still be sent so Nomad follows up. */}
        {urgency === "EMERGENCY" && (
          <div className="flex flex-col gap-2" role="alert">
            <p className="m-0 text-[16px] font-bold text-[#991b1b]">{t("callNowFirst")}</p>
            {emergencyPanel}
          </div>
        )}
      </Section>

      <Section n={3} title={t("whatsHappening")}>
        <label htmlFor="description" className="sr-only">
          {t("whatsHappening")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          minLength={10}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          spellCheck
          autoCapitalize="sentences"
          autoCorrect="on"
          placeholder={t("descriptionPlaceholder")}
          className="border-2 border-pn-border-muted bg-white p-3 text-[16px] outline-none focus:border-pn-ink"
        />
        {fieldError("description") && <p className="m-0 text-[14px] text-[#b91c1c]">{t("descriptionTooShort")}</p>}
      </Section>

      <Section n={4} title={t("whereAreYou")}>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating === "busy"}
          className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 border-2 px-4 text-[15px] font-semibold ${
            coords ? "border-pn-accent bg-pn-accent-soft text-[#08432c]" : "border-pn-ink bg-white"
          }`}
        >
          {coords ? <Check size={18} /> : <LocateFixed size={18} />}
          {coords ? t("locationShared") : locating === "busy" ? t("locating") : t("useMyLocation")}
        </button>
        {locating === "denied" && <p className="m-0 text-[14px] text-pn-gray-1">{t("locationDenied")}</p>}
        {primaryAddress && <p className="m-0 text-[13px] text-pn-gray-2">{t("fromPrimaryAddress")}</p>}
        {coords && (
          <>
            <input type="hidden" name="latitude" value={coords.lat} />
            <input type="hidden" name="longitude" value={coords.lng} />
          </>
        )}
        <label htmlFor="locationLabel" className="text-[14px] font-semibold">
          {t("orTypeTown")}
        </label>
        <input
          id="locationLabel"
          name="locationLabel"
          maxLength={200}
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
          placeholder={t("townPlaceholder")}
          className="h-12 border-2 border-pn-border-muted bg-white px-3 text-[16px] outline-none focus:border-pn-ink"
        />
      </Section>

      <Section n={5} title={t("howToReachYou")}>
        <label htmlFor="contactPhone" className="text-[14px] font-semibold">
          {t("contactPhoneLabel")}
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="77 123 45 67"
            aria-describedby="contactPhoneHelp"
            className="h-12 min-w-0 flex-1 border-2 border-pn-border-muted bg-white px-3 text-[16px] outline-none focus:border-pn-ink"
          />
          {/* Whether the case manager can also reach them on WhatsApp. */}
          <button
            type="button"
            role="switch"
            aria-checked={hasWhatsapp}
            aria-label={t("hasWhatsapp")}
            onClick={() => setHasWhatsapp((v) => !v)}
            className={`flex h-12 flex-none cursor-pointer items-center gap-2 border-2 px-3 text-[14px] font-semibold ${
              hasWhatsapp ? "border-[#128c4a] bg-[#e6f6ec] text-[#0b5a30]" : "border-pn-border-muted bg-white text-pn-gray-1"
            }`}
          >
            <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${hasWhatsapp ? "bg-[#128c4a]" : "bg-pn-border-muted"}`} aria-hidden>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${hasWhatsapp ? "left-[18px]" : "left-0.5"}`} />
            </span>
            WhatsApp
          </button>
          <input type="hidden" name="contactHasWhatsapp" value={hasWhatsapp ? "1" : ""} />
        </div>
        <span id="contactPhoneHelp" className="text-[13px] text-pn-gray-2">
          {t("contactPhoneHelp")}
        </span>
        {fieldError("contactPhone") && <p className="m-0 text-[14px] text-[#b91c1c]">{t("contactPhoneInvalid")}</p>}
      </Section>

      {errors.form && (
        <p role="alert" className="m-0 text-[14px] font-semibold text-[#b91c1c]">
          {errors.form[0]}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-14 cursor-pointer bg-pn-accent text-[17px] font-extrabold text-white active:bg-pn-accent-hover disabled:opacity-50">
        {pending ? t("sending") : t("sendRequest")}
      </button>
      <p className="m-0 -mt-4 text-[13px] text-pn-gray-2">{t("whatHappensNext")}</p>
    </form>
  );
}
