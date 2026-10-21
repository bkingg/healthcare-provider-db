import { getLocale, getTranslations } from "next-intl/server";
import { FileText, Link2Off } from "lucide-react";
import { formatCaseNumber } from "@/lib/caseNumber";
import { formatDakarDateTime } from "@/lib/formatDate";
import { ageFromDateOfBirth } from "@/lib/memberNumber";
import { medicationLabel } from "@/lib/medications";
import { quoteByToken } from "@/data/pharmacyQuotes";
import { QuoteAnswerForm } from "@/components/quote-answer-form";
import { submitQuoteAction } from "../actions";
import { PaymentConfirm } from "./payment-confirm";

/** A pharmacy's private quote page — no login; the link is the key. Shows
 * only what's needed to quote: the items, the prescription when the order
 * needs one (with the patient's name and age), and the distance to the
 * member — never their address or phone. */
export default async function QuotePage(props: PageProps<"/[locale]/q/[token]">) {
  const t = await getTranslations("Quote");
  const locale = await getLocale();
  const { token } = await props.params;
  const q = await quoteByToken(token);

  if (!q) {
    return (
      <main className="flex flex-col gap-3 px-4 py-10 text-center">
        <Link2Off size={36} className="mx-auto text-pn-gray-3" aria-hidden />
        <h1 className="m-0 text-[20px] font-extrabold">{t("goneTitle")}</h1>
        <p className="m-0 text-[15px] text-pn-gray-1">{t("goneBody")}</p>
      </main>
    );
  }

  const o = q.order;
  const age = ageFromDateOfBirth(o.patient.dateOfBirth);
  const answered = q.status === "ANSWERED" || q.status === "DECLINED";
  // Chosen and paid by Nomad: the pharmacy confirms the payment instead of
  // quoting (its answer is locked by now).
  const payout = o.chosenQuoteId === q.id ? o.payments[0] : undefined;
  const paidStage = Boolean(payout) && ["PREPARING", "READY_FOR_PICKUP", "COURIER_REQUESTED", "ORIGINAL_COLLECTED", "PICKED_UP", "DELIVERED", "DELIVERY_FAILED"].includes(o.status);
  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[13px] font-bold tracking-[0.06em] text-pn-gray-2 uppercase">{t("request")}</p>
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{q.provider.names[0]?.fullNameText}</h1>
        <p className="m-0 text-[14px] text-pn-gray-1">
          {t("reference", { ref: formatCaseNumber(o.case.caseNumber) })}
          {/* Once Nomad has paid, there's nothing left to answer by a deadline. */}
          {!paidStage && ` · ${t("validUntil", { when: formatDakarDateTime(q.expiresAt!, locale) })}`}
        </p>
        {q.distanceKm !== null && <p className="m-0 text-[14px] text-pn-gray-1">{t("distance", { km: q.distanceKm })}</p>}
      </div>

      {paidStage && payout && (
        <section className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-3">
          <h2 className="m-0 text-[16px] font-bold">{t("nomadPaidTitle")}</h2>
          <p className="m-0 text-[15px]">
            {t("nomadPaidBody", { amount: `${payout.amountXof.toLocaleString("fr-FR")} FCFA`, method: payout.method === "ORANGE_MONEY" ? "Orange Money" : payout.method === "WAVE" ? "Wave" : payout.method, ref: payout.reference ?? "—" })}
          </p>
          {o.hasNarcotic && <p className="m-0 text-[14px] font-semibold text-[#991b1b]">{t("courierBringsOriginal")}</p>}
          {o.hasColdChain && <p className="m-0 text-[14px] font-semibold text-[#075985]">{t("coldChainPack")}</p>}
          {o.status === "PREPARING" ? <PaymentConfirm token={token} /> : <p className="m-0 font-semibold text-[#0a5c3c]">{t("paymentAlreadyConfirmed")}</p>}
          <ul className="m-0 flex list-none flex-col gap-1 border-t border-pn-rule p-0 pt-2 text-[14px]">
            {o.lines.map((l) => (
              <li key={l.id}>
                {l.freeText ?? medicationLabel({ dci: l.dci ?? "", strength: l.strength, form: l.form ?? "" })} × {l.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {answered && !paidStage && <p className="m-0 border-l-4 border-pn-accent bg-pn-accent-soft px-3 py-2 text-[14px]">{t("alreadyAnswered")}</p>}

      {o.needsPrescription && (
        <section className="flex flex-col gap-2 border-2 border-pn-ink bg-white p-3">
          <h2 className="m-0 text-[15px] font-bold">{t("prescription")}</h2>
          <p className="m-0 text-[14px]">
            {t("patient", { name: `${o.patient.firstName} ${o.patient.lastName}` })}
            {age !== null && ` · ${t("age", { age })}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {o.documents.map((d, i) => (
              <a key={d.id} href={`/api/q/${token}/files/${d.file.id}`} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-1.5 border-2 border-pn-ink px-3 text-[14px] font-semibold text-pn-ink no-underline">
                <FileText size={16} aria-hidden /> {t("document", { n: i + 1 })}
              </a>
            ))}
          </div>
          {o.hasNarcotic && <p className="m-0 text-[14px] font-semibold text-[#991b1b]">{t("narcoticNote")}</p>}
        </section>
      )}

      {!paidStage && (
      <QuoteAnswerForm
        items={o.lines.map((l) => ({
          id: l.id,
          label: l.freeText ?? medicationLabel({ dci: l.dci ?? "", strength: l.strength, form: l.form ?? "" }),
          brand: l.freeText ? t("notInList") : l.brandName,
          quantity: l.quantity,
          narcotic: l.regulatoryClass === "NARCOTIC",
          cold: l.isColdChain,
        }))}
        needsNarcotic={o.hasNarcotic}
        needsCold={o.hasColdChain}
        // Only the pharmacy's own previous answer goes to the browser.
        initial={
          answered
            ? {
                preparationMinutes: q.preparationMinutes,
                canDispenseNarcotic: q.canDispenseNarcotic,
                canPackColdChain: q.canPackColdChain,
                pharmacistName: q.pharmacistName,
                note: q.note,
                lines: q.lines.map((l) => ({
                  orderLineId: l.orderLineId,
                  availability: l.availability,
                  quantityOffered: l.quantityOffered,
                  packPriceXof: l.packPriceXof,
                  packDescription: l.packDescription,
                  unitsPerPack: l.unitsPerPack,
                  substitution: l.substitution,
                })),
              }
            : null
        }
        action={submitQuoteAction}
        hidden={{ token }}
      />
      )}
      {!paidStage && <p className="m-0 text-[13px] text-pn-gray-2">{t("footer")}</p>}
    </main>
  );
}
