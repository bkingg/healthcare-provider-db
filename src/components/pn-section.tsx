/** Mockup's `<section>` pattern: uppercase title, border-bottom rule,
 * replacing the shadcn Card wrapper the CRUD sections used before. */
export function PnSection({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className="border-b-2 border-pn-ink py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="m-0 text-xs font-extrabold tracking-[0.09em] uppercase">{title}</h2>
        {action}
      </div>
      <div className={className}>{children}</div>
    </section>
  );
}

/** Smaller variant for side-by-side panels (e.g. Phones/Emails/Contacts) —
 * a bordered box instead of a full-width bottom-ruled section. `action`
 * (e.g. an "+ Add" button opening a dialog) is optional — most panels here
 * still use a permanently-visible inline add-form instead. */
export function PnPanel({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-pn-ink">
      <div className="flex items-center justify-between gap-2 bg-pn-ink px-3 py-1.5 text-[10px] font-bold tracking-[0.09em] text-white uppercase">
        <span>{title}</span>
        {action}
      </div>
      <div className={`p-3 ${className ?? ""}`}>{children}</div>
    </div>
  );
}
