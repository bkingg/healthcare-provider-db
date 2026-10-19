"use client";

import { startTransition } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "@base-ui/react/menu";
import { LogOut, MapPin, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { signOutMemberAction } from "../actions";

/** Top right of the member header: the member's initials open a menu with
 * who's signed in, their profile, their primary address and — tucked away
 * so it isn't hit by accident — Sign out. */
export function MemberMenu({ name, memberId, covered }: { name: string; memberId: string; covered: boolean }) {
  const t = useTranslations("MemberProfile");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const item = "flex min-h-11 cursor-pointer items-center gap-2.5 px-4 text-[15px] text-pn-ink no-underline outline-none data-[highlighted]:bg-pn-surface-hover";

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={t("menuLabel", { name })}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-pn-gray-3 bg-pn-accent text-[14px] font-bold text-white hover:border-white data-[popup-open]:border-white"
      >
        {initials || <UserRound size={18} aria-hidden />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8} className="z-[100]">
          <Menu.Popup className="min-w-[240px] border-2 border-pn-ink bg-white py-1 text-pn-ink shadow-lg outline-none">
            <div className="flex flex-col gap-0.5 border-b border-pn-rule px-4 pt-2 pb-3">
              <span className="text-[15px] font-bold">{name}</span>
              <span className="text-[13px] text-pn-gray-2 tabular-nums">{memberId}</span>
              <span className={`text-[12px] font-semibold ${covered ? "text-[#0a5c3c]" : "text-[#b45309]"}`}>{covered ? t("covered") : t("notCovered")}</span>
            </div>
            <Menu.LinkItem closeOnClick render={<Link href="/m/profile" />} className={item}>
              <UserRound size={17} aria-hidden /> {t("myProfile")}
            </Menu.LinkItem>
            <Menu.LinkItem closeOnClick render={<Link href="/m/address" />} className={item}>
              <MapPin size={17} aria-hidden /> {t("primaryAddress")}
            </Menu.LinkItem>
            <Menu.Separator className="my-1 h-px bg-pn-rule" />
            <Menu.Item onClick={() => startTransition(() => signOutMemberAction())} className={`${item} text-[#991b1b]`}>
              <LogOut size={17} aria-hidden /> {t("signOut")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
