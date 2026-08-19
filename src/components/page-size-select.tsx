"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PAGE_SIZE_OPTIONS } from "@/lib/validation/search";

type RawParams = Record<string, string | string[] | undefined>;

export function PageSizeSelect({ pageSize, rawParams }: { pageSize: number; rawParams: RawParams }) {
  const t = useTranslations("Search");
  const router = useRouter();

  function handleChange(next: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(rawParams)) {
      if (v === undefined || k === "pageSize" || k === "cursors") continue;
      for (const single of Array.isArray(v) ? v : [v]) params.append(k, single);
    }
    params.set("pageSize", next);
    router.push(`/providers?${params.toString()}`);
  }

  return (
    <select
      value={pageSize}
      onChange={(e) => handleChange(e.target.value)}
      className="h-6 border-2 border-pn-ink bg-white px-1.5 font-[inherit] text-[11px]"
    >
      {PAGE_SIZE_OPTIONS.map((n) => (
        <option key={n} value={n}>
          {t("perPage", { count: n })}
        </option>
      ))}
    </select>
  );
}
