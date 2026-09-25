"use client";

import { useTranslations } from "next-intl";
import { MAP_ICON_COMPONENTS, MarkerPin } from "@/components/map-marker-pin";
import { MAP_ICON_KEYS, RECOMMENDED_MARKER_COLORS, isHexColor, type MarkerStyle } from "@/lib/mapMarkerStyle";

/** Icon grid for a provider type's map marker (FieldDef kind "mapIcon").
 * Submits through a hidden input like the rest of the value-list form; an
 * empty value means "use the type's built-in default", which is the first
 * option and shows what that default is. */
export function MapIconPicker({
  name,
  label,
  value,
  defaultStyle,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  defaultStyle: MarkerStyle;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Admin.marker");
  const DefaultIcon = MAP_ICON_COMPONENTS[defaultStyle.icon];

  const option = (key: string, title: string, content: React.ReactNode) => {
    const selected = value === key;
    return (
      <button
        key={key || "default"}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={title}
        title={title}
        onClick={() => onChange(key)}
        className={`flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 border-2 px-1.5 ${
          selected ? "border-pn-ink bg-pn-surface-hover" : "border-pn-rule hover:border-pn-gray-3"
        }`}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="col-span-2 flex flex-col gap-1.5">
      <span id={`${name}-label`} className="text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-labelledby={`${name}-label`} className="flex flex-wrap gap-1">
        {option(
          "",
          t("defaultIcon"),
          <>
            <DefaultIcon size={16} className="opacity-60" />
            <span className="text-[11px] font-semibold">{t("default")}</span>
          </>,
        )}
        {MAP_ICON_KEYS.map((key) => {
          const Icon = MAP_ICON_COMPONENTS[key];
          return option(key, t(`icons.${key}`), <Icon size={16} />);
        })}
      </div>
    </div>
  );
}

/** Color choice for a provider type's map marker (FieldDef kind "color"):
 * "Default", the recommended swatches, or any custom color. Shows a live
 * preview of the resulting map pin. */
export function MarkerColorPicker({
  name,
  label,
  value,
  defaultStyle,
  previewStyle,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  defaultStyle: MarkerStyle;
  previewStyle: MarkerStyle;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Admin.marker");
  const isCustom = value !== "" && !(RECOMMENDED_MARKER_COLORS as readonly string[]).includes(value);

  const swatch = (color: string, key: string, title: string, content?: React.ReactNode) => {
    const selected = value === key;
    return (
      <button
        key={key || "default"}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={title}
        title={title}
        onClick={() => onChange(key)}
        className={`flex h-8 min-w-8 cursor-pointer items-center justify-center border-2 px-1 text-[11px] font-semibold text-white ${
          selected ? "border-pn-ink ring-2 ring-pn-ink ring-offset-1" : "border-white"
        }`}
        style={{ background: color }}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="col-span-2 flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <span id={`${name}-label`} className="text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">
          {label}
        </span>
        <input type="hidden" name={name} value={value} />
        <div role="radiogroup" aria-labelledby={`${name}-label`} className="flex flex-wrap items-center gap-1">
          {swatch(defaultStyle.color, "", t("defaultColor"), t("default"))}
          {RECOMMENDED_MARKER_COLORS.map((c) => swatch(c, c, c))}
          <label
            title={t("customColor")}
            className={`relative flex h-8 cursor-pointer items-center gap-1.5 border-2 px-1.5 text-[11px] font-semibold ${
              isCustom ? "border-pn-ink" : "border-pn-rule hover:border-pn-gray-3"
            }`}
          >
            <input
              type="color"
              aria-label={t("customColor")}
              value={isHexColor(value) ? value : previewStyle.color}
              onChange={(e) => onChange(e.target.value.toLowerCase())}
              className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
            {isCustom ? value : t("custom")}
          </label>
        </div>
      </div>
      <div className="flex flex-none flex-col items-center gap-1">
        <span className="text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase">{t("preview")}</span>
        <div className="flex h-[58px] w-[58px] items-end justify-center bg-[#e8e4dc] pb-1.5">
          <MarkerPin style={previewStyle} height={44} />
        </div>
      </div>
    </div>
  );
}
