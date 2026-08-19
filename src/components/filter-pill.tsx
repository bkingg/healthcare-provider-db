import { Link } from "@/i18n/navigation";

/** Toggle-able filter chip — matches the mockup's filter aside exactly: a
 * plain link that adds/removes itself from the URL's multi-value param, so
 * the whole search screen stays server-rendered/no-JS-required like the rest
 * of the filter bar. */
export function FilterPill({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "bg-pn-ink px-[7px] py-[2px] text-[11px] font-semibold text-white"
          : "border border-pn-border-muted px-[7px] py-[1px] text-[11px] text-pn-gray-2 hover:border-pn-ink hover:text-pn-ink"
      }
    >
      {label}
    </Link>
  );
}
