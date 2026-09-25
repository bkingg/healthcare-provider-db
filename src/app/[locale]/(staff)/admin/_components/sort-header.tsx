import { Link } from "@/i18n/navigation";
import { TableHead } from "@/components/ui/table";

/** Column header that sorts the admin list by that column: the first click
 * sorts ascending, clicking the active column again flips the direction.
 * Sorting is a URL param (`?list=…&sort=…&dir=…`) so the server renders the
 * sorted rows — same approach as the provider results table. */
export function SortHeader({
  label,
  col,
  listKey,
  currentSort,
  currentDir,
}: {
  label: string;
  col: string;
  listKey: string;
  currentSort: string | undefined;
  currentDir: "asc" | "desc";
}) {
  const active = currentSort === col;
  const nextDir = active && currentDir === "asc" ? "desc" : "asc";
  return (
    <TableHead aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={`/admin?list=${listKey}&sort=${col}&dir=${nextDir}`} className={`flex items-center gap-1 hover:text-pn-ink ${active ? "text-pn-ink" : ""}`}>
        {label}
        <span className="text-[9px] leading-none">{active ? (currentDir === "asc" ? "▲" : "▼") : ""}</span>
      </Link>
    </TableHead>
  );
}
