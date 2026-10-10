import Image from "next/image";

// Nomad's logo, from the source artwork (Documents/NOMAD/NOMAD.png), cut out
// into public/brand/: the round emblem and the NOMAD wordmark, each in the
// brand green (#055732) for light backgrounds and in white for the dark
// headers. App icons and the favicon live in src/app/ (icon.png,
// apple-icon.png, favicon.ico).

/** The round emblem (heart and stethoscope). */
export function NomadMark({ size = 28, tone = "white", className = "" }: { size?: number; tone?: "white" | "green"; className?: string }) {
  return <Image src={tone === "white" ? "/brand/nomad-mark-white.png" : "/brand/nomad-mark.png"} alt="" width={size} height={size} className={`flex-none ${className}`} />;
}

/** The NOMAD wordmark, `height` px tall. Carries the accessible name. */
export function NomadWordmark({ height = 16, tone = "white", className = "" }: { height?: number; tone?: "white" | "green"; className?: string }) {
  // The artwork is about 4.9 : 1.
  return (
    <Image
      src={tone === "white" ? "/brand/nomad-wordmark-white.png" : "/brand/nomad-wordmark.png"}
      alt="Nomad"
      width={Math.round(height * 4.88)}
      height={height}
      className={`flex-none ${className}`}
    />
  );
}

/** Emblem above wordmark, as on the artwork — for sign-in pages. */
export function NomadLogo({ height = 96, className = "" }: { height?: number; className?: string }) {
  // The stacked artwork is about 1.2 : 1 (wide : tall).
  return <Image src="/brand/nomad-logo.png" alt="Nomad" width={Math.round(height * 1.21)} height={height} preload className={className} />;
}

/** Emblem + wordmark side by side, white — for the dark app headers. */
export function NomadHeaderLogo({ markSize = 28, wordHeight = 15 }: { markSize?: number; wordHeight?: number }) {
  return (
    <span className="flex items-center gap-2">
      <NomadMark size={markSize} />
      {/* Emblem only on the narrowest phones, where the header also holds
       * Back, the language switch and sign-out. */}
      <NomadWordmark height={wordHeight} className="max-[359px]:hidden" />
    </span>
  );
}
