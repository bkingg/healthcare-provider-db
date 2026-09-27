"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PreviewCard } from "@base-ui/react/preview-card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FormattedNote, type NoteMentions } from "@/components/formatted-note";
import { notePreview } from "@/lib/notePreview";

export type NoteItem = { id: string; typeName: string | null; author: string; when: string; body: string; mentions?: NoteMentions; mentionsMe?: boolean };

/** The internal notes on a case, each collapsed to one line (type, author,
 * date, a preview of its content) to save space. Hovering — or tabbing
 * to — a collapsed note shows the whole note in a pop-up; clicking opens or
 * closes it in place (the only way on touch screens, where there's no
 * hover). Expand all / Collapse all opens or closes every note. Newest
 * first — `notes` arrive oldest-first, like the rest of the timeline.
 * `focusId` (from a bell link) starts that note open, highlighted and in
 * view. */
export function NotesList({ notes, focusId = null }: { notes: NoteItem[]; focusId?: string | null }) {
  const t = useTranslations("Cases");
  const [open, setOpen] = useState<Set<string>>(() => new Set(focusId ? [focusId] : []));
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId]);
  const allOpen = notes.length > 0 && notes.every((n) => open.has(n.id));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (notes.length === 0) return <p className="m-0 py-4 text-center text-[12.5px] text-pn-gray-3">{t("notesEmpty")}</p>;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(allOpen ? new Set() : new Set(notes.map((n) => n.id)))}
        className="cursor-pointer self-end text-[11px] font-semibold text-[#92400e] hover:underline"
      >
        {allOpen ? t("collapseAllNotes") : t("expandAllNotes", { count: notes.length })}
      </button>
      {/* Newest note first, at the top of the scroll area. */}
      <div className="max-h-[420px] overflow-auto">
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {[...notes].reverse().map((n) => {
            const isOpen = open.has(n.id);
            const header = (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`note-${n.id}`}
                onClick={() => toggle(n.id)}
                className="flex w-full cursor-pointer flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-[#fffaf0]"
              >
                <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-pn-gray-2">
                  {isOpen ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                  {n.typeName && <span className="bg-[#fcefd9] px-1.5 font-semibold text-[#92400e]">{n.typeName}</span>}
                  <span>
                    <span className="font-semibold text-pn-gray-1">{n.author}</span> · {n.when}
                  </span>
                  {n.mentionsMe && <span className="bg-[#fde68a] px-1.5 font-semibold text-[#78350f]">{t("mentionsYou")}</span>}
                </span>
                {!isOpen && <span className="block truncate pl-[20px] text-[12.5px] text-pn-gray-1">{notePreview(n.body) || "—"}</span>}
              </button>
            );
            return (
              <li
                key={n.id}
                ref={n.id === focusId ? focusRef : undefined}
                className={`border-l-4 border-[#b45309] bg-white ${n.id === focusId ? "outline-2 outline-[#d97706]" : ""}`}
              >
                {isOpen ? (
                  header
                ) : (
                  // Hover (or keyboard focus) peeks at the whole note.
                  <PreviewCard.Root>
                    {/* The note's own button is the trigger, so keyboard focus
                     * shows the preview as well as mouse hover. */}
                    <PreviewCard.Trigger delay={250} closeDelay={100} render={header} />
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner side="left" align="start" sideOffset={8} collisionPadding={12} className="z-[100]">
                        <PreviewCard.Popup className="max-h-[min(420px,var(--available-height))] w-[min(440px,var(--available-width))] overflow-auto border-2 border-[#b45309] bg-white p-3 text-[13px] shadow-lg">
                          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-pn-gray-2">
                            {n.typeName && <span className="bg-[#fcefd9] px-1.5 font-semibold text-[#92400e]">{n.typeName}</span>}
                            <span>
                              <span className="font-semibold text-pn-gray-1">{n.author}</span> · {n.when}
                            </span>
                          </div>
                          <FormattedNote text={n.body} mentions={n.mentions} />
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                )}
                <div id={`note-${n.id}`} hidden={!isOpen} className="px-3 pt-0.5 pb-2 pl-[32px] text-[13.5px]">
                  <FormattedNote text={n.body} mentions={n.mentions} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
