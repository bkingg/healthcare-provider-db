/** Badge colors for a country's healthcare-system rating (see
 * RatingScaleRef): 5 dark green, 4 light green, 3 yellow, 2 orange, 1 red.
 * Unrated — or no rating at all — gets no color. The label and number are
 * always shown too, so the color is never the only signal. */
const LEVEL_CLASSES: Record<number, string> = {
  5: "border-[#14532d] bg-[#14532d] text-white",
  4: "border-[#4ade80] bg-[#86efac] text-pn-ink",
  3: "border-[#facc15] bg-[#fde047] text-pn-ink",
  2: "border-[#f97316] bg-[#fdba74] text-pn-ink",
  1: "border-[#b91c1c] bg-[#dc2626] text-white",
};

const NO_COLOR_CLASSES = "border-pn-border-muted bg-transparent text-pn-gray-1";

export function healthSystemRatingClasses(numericValue: number | null | undefined): string {
  if (numericValue === null || numericValue === undefined) return NO_COLOR_CLASSES;
  return LEVEL_CLASSES[Math.round(numericValue)] ?? NO_COLOR_CLASSES;
}
