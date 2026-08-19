"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { HoverTip } from "@/components/ui/tooltip";

const STARS = [1, 2, 3, 4, 5] as const;

/** 5-star rating. Read-only unless `onChange` is given; with it, click a star
 * to set that rating and click the current one again to clear it (the parent
 * owns the value and saves it). Hovering the label shows the rating's general
 * `description`; hovering a star shows what that many stars means
 * (`meanings[n - 1]`) — both are admin-editable text (Admin > Value lists >
 * Rating Descriptions). */
export function StarRating({
  label,
  value,
  onChange,
  description,
  meanings = [],
}: {
  label: string;
  value: number | null;
  onChange?: (value: number | null) => void;
  description?: string | null;
  meanings?: (string | null)[];
}) {
  const t = useTranslations("Profile");
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <HoverTip content={description}>
        <span className={`text-[10px] tracking-[0.09em] text-pn-gray-3 uppercase ${description ? "cursor-help underline decoration-dotted underline-offset-2" : ""}`}>
          {label}
        </span>
      </HoverTip>
      <div role={onChange ? "radiogroup" : "img"} aria-label={`${label}: ${value ? t("starsCount", { count: value }) : t("notRated")}`} className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {STARS.map((n) => {
          const meaning = meanings[n - 1];
          const tip = [t("starsCount", { count: n }), meaning].filter(Boolean).join(" — ");
          const icon = (
            <Star size={20} strokeWidth={1.75} className={n <= shown ? "fill-pn-accent text-pn-accent" : "fill-transparent text-pn-border-muted"} />
          );
          return onChange ? (
            <HoverTip key={n} content={meaning ? tip : undefined}>
              <button
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={t("starsCount", { count: n })}
                onMouseEnter={() => setHover(n)}
                onClick={() => onChange(value === n ? null : n)}
                className="cursor-pointer p-0.5"
              >
                {icon}
              </button>
            </HoverTip>
          ) : (
            <HoverTip key={n} content={meaning ? tip : undefined}>
              <span className="p-0.5" onMouseEnter={() => setHover(null)}>
                {icon}
              </span>
            </HoverTip>
          );
        })}
      </div>
    </div>
  );
}
