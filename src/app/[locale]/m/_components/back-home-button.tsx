"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

/** Top-left of the member header on a phone: back to the home page, shown
 * on a submitted request, the profile and the primary address. (On a computer the requests list is
 * always on the left, so it isn't needed.) */
export function BackHomeButton() {
  const t = useTranslations("MemberApp");
  const pathname = usePathname();
  if (!/^\/m\/(requests\/[^/]+|profile|address)$/.test(pathname)) return null;
  return (
    <Link href="/m" aria-label={t("backHome")} className="-ml-2 flex h-11 items-center gap-0.5 pr-2 pl-1 text-[15px] font-semibold text-white no-underline hover:text-pn-gray-4 lg:hidden">
      <ChevronLeft size={22} aria-hidden /> {t("back")}
    </Link>
  );
}
