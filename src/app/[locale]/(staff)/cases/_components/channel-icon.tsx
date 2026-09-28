import { Footprints, Mail, MessageCircle, Phone, Smartphone } from "lucide-react";

/** How the member got in touch, as a small icon (with the label for screen
 * readers and on hover). */
export function ChannelIcon({ channel, label, size = 13 }: { channel: string; label: string; size?: number }) {
  const Icon = channel === "PHONE" ? Phone : channel === "EMAIL" ? Mail : channel === "WHATSAPP" ? MessageCircle : channel === "WALK_IN" ? Footprints : Smartphone;
  return (
    <span title={label} className="inline-flex items-center text-pn-gray-2">
      <Icon size={size} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** "Special request" tag — someone helped without cover, free or at a set cost. */
export function CoverageTag({ coverage, label }: { coverage: string; label: string }) {
  if (coverage === "COVERED") return null;
  return <span className="bg-[#fde8d0] px-1.5 text-[11px] font-bold text-[#9a3412]">{label}</span>;
}
