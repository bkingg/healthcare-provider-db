import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Queue | My actions — the two views of the Cases area. */
export async function CasesTabs({ current, myActions }: { current: "queue" | "actions"; myActions: number }) {
  const t = await getTranslations("Cases");
  const tab = (key: "queue" | "actions", href: string, label: React.ReactNode) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex items-center gap-1.5 border-b-4 px-1 pb-1.5 text-[13px] font-semibold no-underline ${current === key ? "border-pn-ink text-pn-ink" : "border-transparent text-pn-gray-2 hover:text-pn-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label={t("title")} className="flex gap-5">
      {tab("queue", "/cases", t("tabQueue"))}
      {tab(
        "actions",
        "/cases/my-actions",
        <>
          {t("tabMyActions")}
          {myActions > 0 && <span className="bg-pn-ink px-1.5 text-[11px] text-white tabular-nums">{myActions}</span>}
        </>,
      )}
    </nav>
  );
}
