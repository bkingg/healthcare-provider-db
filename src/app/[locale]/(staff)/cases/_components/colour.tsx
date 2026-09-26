export const COLOUR_STYLE = {
  RED: { stripe: "bg-[#c62828]", pill: "bg-[#c62828] text-white", soft: "bg-[#fbe5e5]" },
  YELLOW: { stripe: "bg-[#d99a06]", pill: "bg-[#f4c542] text-[#3a2a00]", soft: "bg-[#fcefd9]" },
  GREEN: { stripe: "bg-[#15803d]", pill: "bg-[#15803d] text-white", soft: "bg-[#e4f4e8]" },
} as const;

export type Colour = keyof typeof COLOUR_STYLE;

/** The case's red / yellow / green, in colour and in words — never colour
 * alone, so it reads for colour-blind staff and on a greyscale print. */
export function ColourPill({ rag, label }: { rag: string; label: string }) {
  const style = COLOUR_STYLE[rag as Colour] ?? COLOUR_STYLE.GREEN;
  return <span className={`inline-block px-2 py-px text-[11px] font-bold tracking-[0.04em] uppercase ${style.pill}`}>{label}</span>;
}
