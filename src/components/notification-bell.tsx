"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { AtSign, Bell, ListTodo, Pill } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { formatCaseNumber } from "@/lib/caseNumber";
import { localizedText } from "@/lib/localizedText";
import { shortDuration } from "@/lib/caseTime";
import type { BellCase, BellData } from "@/lib/bellData";
import { PushToggle } from "@/components/push-toggle";
import { getBellAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/app/[locale]/(staff)/cases/bell-actions";

const REFRESH_MS = 60_000;

/** The header bell: your next actions that are due now (they stay until
 * ticked off), then mentions and actions given to you. The number is both
 * together. Refreshes on every page change and every minute; phone alerts
 * (switch at the bottom) say when something new comes in. */
export function NotificationBell({ initial, pushKey }: { initial: BellData; pushKey: string | null }) {
  const t = useTranslations("Bell");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  // "5 min ago" is worked out when the list opens, not on every render.
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      getBellAction()
        .then((next) => {
          if (!cancelled && next) setData(next);
        })
        .catch(() => {
          // Offline or signed out mid-way: keep showing what we had.
        });
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);

  const caseLine = (c: BellCase) => `${formatCaseNumber(c.caseNumber)} · ${localizedText(c.categoryEn, c.categoryFr, locale) ?? c.categoryEn} · ${c.patient}`;
  const ago = (iso: string) => t("ago", { time: shortDuration(Math.max(0, openedAt - new Date(iso).getTime())) });

  function go(href: string, notificationId?: string) {
    setOpen(false);
    if (notificationId) {
      setData((d) => ({
        ...d,
        unread: Math.max(0, d.unread - (d.items.find((i) => i.id === notificationId && !i.read) ? 1 : 0)),
        count: Math.max(0, d.count - (d.items.find((i) => i.id === notificationId && !i.read) ? 1 : 0)),
        items: d.items.map((i) => (i.id === notificationId ? { ...i, read: true } : i)),
      }));
      void markNotificationReadAction(notificationId);
    }
    router.push(href);
  }

  const label = data.count ? t("labelCount", { count: data.count }) : t("label");

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setOpenedAt(Date.now());
      }}
    >
      <Popover.Trigger aria-label={label} title={label} className="relative flex cursor-pointer items-center text-pn-gray-4 hover:text-white">
        <Bell size={16} strokeWidth={2} />
        {data.count > 0 && (
          <span className="absolute -top-2 -right-2.5 min-w-[17px] bg-[#dc2626] px-1 text-center text-[10.5px] leading-[16px] font-bold text-white tabular-nums">
            {data.count > 99 ? "99+" : data.count}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={10} collisionPadding={8} className="z-[100]">
          <Popover.Popup className="flex max-h-[min(560px,var(--available-height))] w-[min(400px,var(--available-width))] flex-col overflow-hidden border-2 border-pn-ink bg-white text-pn-ink shadow-lg outline-none">
            <div className="overflow-auto">
              <section>
                <h2 className="m-0 flex items-center justify-between bg-pn-ink px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-white uppercase">
                  <span>{t("dueNow")}</span>
                  <span className="tabular-nums">{data.dueCount}</span>
                </h2>
                {data.due.length === 0 ? (
                  <p className="m-0 px-3 py-2.5 text-[12.5px] text-pn-gray-3">{t("nothingDue")}</p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {data.due.map((a) => {
                      const late = new Date(a.dueAt).getTime() < openedAt;
                      return (
                        <li key={a.actionId} className="border-b border-pn-rule">
                          <button type="button" onClick={() => go(`/cases/${a.case.id}?action=${a.actionId}`)} className="flex w-full cursor-pointer gap-2 px-3 py-2 text-left hover:bg-pn-surface-hover">
                            <ListTodo size={14} className="mt-0.5 flex-none text-[#c62828]" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold break-words">{a.title}</span>
                              <span className="block truncate text-[11.5px] text-pn-gray-2">{caseLine(a.case)}</span>
                            </span>
                            <span className={`flex-none text-[11.5px] tabular-nums ${late ? "font-bold text-[#c62828]" : "text-pn-gray-2"}`}>
                              {late ? t("overdueBy", { time: shortDuration(openedAt - new Date(a.dueAt).getTime()) }) : t("dueNowShort")}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {data.dueCount > data.due.length && (
                  <button type="button" onClick={() => go("/cases/my-actions")} className="w-full cursor-pointer px-3 py-1.5 text-left text-[12px] font-semibold text-[#0a5c3c] hover:underline">
                    {t("seeAllActions", { count: data.dueCount })}
                  </button>
                )}
              </section>

              <section>
                <h2 className="m-0 flex items-center justify-between bg-pn-ink px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-white uppercase">
                  <span>{t("forYou")}</span>
                  {data.unread > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void markAllNotificationsReadAction().then((next) => {
                          if (next) setData(next);
                        })
                      }
                      className="cursor-pointer text-[11px] font-semibold tracking-normal text-[#b7e4c7] normal-case hover:underline"
                    >
                      {t("markAllRead")}
                    </button>
                  )}
                </h2>
                {data.items.length === 0 ? (
                  <p className="m-0 px-3 py-2.5 text-[12.5px] text-pn-gray-3">{t("nothingNew")}</p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {data.items.map((n) => (
                      <li key={n.id} className={`border-b border-pn-rule ${n.read ? "" : "bg-[#fffaf0]"}`}>
                        <button type="button" onClick={() => go(n.href, n.id)} className="flex w-full cursor-pointer gap-2 px-3 py-2 text-left hover:bg-pn-surface-hover">
                          {n.kind === "ORDER_UPDATE" ? (
                            <Pill size={14} className={`mt-0.5 flex-none ${n.read ? "text-pn-gray-3" : "text-[#b45309]"}`} aria-hidden />
                          ) : n.kind === "MENTION" ? (
                            <AtSign size={14} className={`mt-0.5 flex-none ${n.read ? "text-pn-gray-3" : "text-[#b45309]"}`} aria-hidden />
                          ) : (
                            <ListTodo size={14} className={`mt-0.5 flex-none ${n.read ? "text-pn-gray-3" : "text-[#b45309]"}`} aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[12.5px] ${n.read ? "text-pn-gray-2" : "font-semibold"}`}>
                              {n.kind === "ORDER_UPDATE"
                                ? t.has(`orderUpdate.${n.eventType}`)
                                  ? t(`orderUpdate.${n.eventType}`, { who: n.actor ?? t("someone") })
                                  : t("orderUpdate.other")
                                : t(n.kind === "MENTION" ? "mentionedYou" : "gaveYouAction", { who: n.actor ?? t("someone") })}
                              {!n.read && <span className="sr-only"> ({t("unread")})</span>}
                            </span>
                            {n.text && <span className="block truncate text-[12.5px] text-pn-gray-1">“{n.text}”</span>}
                            <span className="block truncate text-[11.5px] text-pn-gray-2">{caseLine(n.case)}</span>
                          </span>
                          <span className="flex-none text-[11px] text-pn-gray-3 tabular-nums">{ago(n.at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            {pushKey && (
              <div className="border-t-2 border-pn-ink px-3 py-2">
                <PushToggle who="staff" publicKey={pushKey} compact />
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
