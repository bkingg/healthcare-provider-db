/** The member's price for a medication order (step 4): medicines from the
 * chosen pharmacy's quote + delivery + Nomad's fee. All FCFA. Pure — the
 * settings come from Admin > Value lists > Medication delivery settings. */

export type PricingSettings = {
  feeBaseXof: number;
  feePercent: number;
  nightSurchargeXof: number;
  nightStartHour: number;
  nightEndHour: number;
  roundXof: number;
};

export type ChosenLine = { orderLineId: string; availability: string; quantityOffered: number | null; packPriceXof: number | null; substitution: string | null };

export type PricedItem = { lineId: string; quantity: number; unitXof: number; subtotalXof: number; substitution: string | null; included: boolean };

export type OrderPrice = { items: PricedItem[]; medicinesXof: number; deliveryXof: number; feeXof: number; totalXof: number; night: boolean };

export const roundUp = (n: number, step: number) => (step > 1 ? Math.ceil(n / step) * step : Math.ceil(n));

/** Night in Dakar (UTC+0); a window like 22→7 crosses midnight. */
export function isNight(at: Date, startHour: number, endHour: number): boolean {
  const h = at.getUTCHours();
  return startHour > endHour ? h >= startHour || h < endHour : h >= startHour && h < endHour;
}

export function priceOrder(
  lines: { id: string; quantity: number }[],
  chosen: ChosenLine[],
  deliveryEstimateXof: number,
  at: Date,
  s: PricingSettings,
): OrderPrice {
  const items = lines.map((l) => {
    const c = chosen.find((x) => x.orderLineId === l.id);
    const qty = !c || c.availability === "UNAVAILABLE" || c.packPriceXof === null ? 0 : c.availability === "PARTIAL" ? Math.min(c.quantityOffered ?? 0, l.quantity) : l.quantity;
    const unit = c?.packPriceXof ?? 0;
    return { lineId: l.id, quantity: qty, unitXof: unit, subtotalXof: qty * unit, substitution: qty > 0 ? (c?.substitution ?? null) : null, included: qty > 0 };
  });
  const medicinesXof = items.reduce((sum, i) => sum + i.subtotalXof, 0);
  const deliveryXof = roundUp(deliveryEstimateXof, s.roundXof);
  const night = isNight(at, s.nightStartHour, s.nightEndHour);
  const feeXof = roundUp(s.feeBaseXof + (medicinesXof * s.feePercent) / 100 + (night ? s.nightSurchargeXof : 0), s.roundXof);
  return { items, medicinesXof, deliveryXof, feeXof, totalXof: medicinesXof + deliveryXof + feeXof, night };
}
