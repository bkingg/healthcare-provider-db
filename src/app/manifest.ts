import type { MetadataRoute } from "next";

/** Lets members add the member app to their phone's home screen (MVP step
 * 1.2 — a mobile web app instead of native apps). Opens on the member app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nomad",
    short_name: "Nomad",
    description: "Request help from Nomad",
    start_url: "/fr/m",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f5",
    theme_color: "#14201a",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Extra margin so Android's round / squircle masks don't clip the emblem.
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
