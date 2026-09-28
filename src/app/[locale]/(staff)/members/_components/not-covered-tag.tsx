/** Marks someone Nomad helps without cover — their cases are special
 * requests (free or at a set cost). */
export function NotCoveredTag({ label }: { label: string }) {
  return <span className="ml-2 inline-block bg-[#fde8d0] px-1.5 text-[10.5px] font-bold tracking-[0.04em] text-[#9a3412] uppercase">{label}</span>;
}
