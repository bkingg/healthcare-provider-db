import {
  Accessibility,
  Activity,
  Ambulance,
  Baby,
  Bone,
  Brain,
  BriefcaseMedical,
  Building2,
  Cross,
  Dna,
  Ear,
  Eye,
  Flag,
  HandHeart,
  HeartPulse,
  Hospital,
  House,
  MapPin,
  Microscope,
  Pill,
  Smile,
  Stethoscope,
  Syringe,
  TestTube,
  type LucideIcon,
} from "lucide-react";
import { glyphColorFor, type MapIconKey, type MarkerStyle } from "@/lib/mapMarkerStyle";

export const MAP_ICON_COMPONENTS: Record<MapIconKey, LucideIcon> = {
  hospital: Hospital,
  stethoscope: Stethoscope,
  building: Building2,
  pill: Pill,
  "heart-pulse": HeartPulse,
  microscope: Microscope,
  ambulance: Ambulance,
  baby: Baby,
  bone: Bone,
  brain: Brain,
  eye: Eye,
  ear: Ear,
  smile: Smile,
  syringe: Syringe,
  "test-tube": TestTube,
  dna: Dna,
  activity: Activity,
  cross: Cross,
  "briefcase-medical": BriefcaseMedical,
  "hand-heart": HandHeart,
  accessibility: Accessibility,
  house: House,
  "map-pin": MapPin,
};

/** Pin's native size; `height` scales it. */
export const PIN_WIDTH = 30;
export const PIN_HEIGHT = 40;

/** A provider's map marker: a solid teardrop pin in its type's color with
 * the type's icon in white (or near-black on a light color), a white
 * outline and a soft shadow. A pin shape and saturated fill on purpose —
 * OpenStreetMap draws its own points of interest as small flat icons, and
 * the previous white-circle markers were easy to mistake for them. Rendered
 * as plain SVG so the same markup serves both the Leaflet icon (via
 * renderToStaticMarkup, see map/_components/marker-icons.tsx) and the live
 * preview in the admin value list editor. */
export function MarkerPin({ style, height = PIN_HEIGHT, doNotUse = false }: { style: MarkerStyle; height?: number; doNotUse?: boolean }) {
  const Icon = MAP_ICON_COMPONENTS[style.icon];
  const width = (height * PIN_WIDTH) / PIN_HEIGHT;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
      width={width}
      height={height}
      style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 1.5px 1.5px rgba(20,32,26,0.45))" }}
      aria-hidden
    >
      <path
        d="M15 38.5C15 38.5 3 25.6 3 15a12 12 0 0 1 24 0c0 10.6-12 23.5-12 23.5z"
        fill={style.color}
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Icon x={7.5} y={7.5} width={15} height={15} strokeWidth={2.4} color={glyphColorFor(style.color)} />
      {/* DO_NOT_USE badge: red disc with a white flag on the pin's
       * top-right shoulder, overlapping the edge so it reads as a warning
       * attached to the provider rather than part of its type icon. */}
      {doNotUse && (
        <g>
          <circle cx={25.5} cy={4.5} r={6.5} fill="#dc2626" stroke="#ffffff" strokeWidth={1.75} />
          <Flag x={21.5} y={0.5} width={8} height={8} strokeWidth={2.6} color="#ffffff" fill="#ffffff" />
        </g>
      )}
    </svg>
  );
}
