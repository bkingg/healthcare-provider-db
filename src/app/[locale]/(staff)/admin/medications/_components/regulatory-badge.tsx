/** A regulatory class as a coloured badge: narcotics stand out in red,
 * Liste I/II in amber, unlisted items stay quiet. */
export function RegulatoryBadge({ value, label }: { value: string; label: string }) {
  const style =
    value === "NARCOTIC" ? "bg-[#c62828] text-white" : value === "LIST_I" ? "bg-[#fde8d0] text-[#9a3412]" : value === "LIST_II" ? "bg-[#fef3c7] text-[#92400e]" : "bg-pn-panel text-pn-gray-2";
  return <span className={`inline-block px-1.5 py-px text-[10.5px] font-bold tracking-[0.03em] whitespace-nowrap uppercase ${style}`}>{label}</span>;
}
