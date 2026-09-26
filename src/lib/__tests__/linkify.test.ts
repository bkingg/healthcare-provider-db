import { describe, expect, it } from "vitest";
import { splitLinks } from "@/lib/linkify";

const links = (text: string) => splitLinks(text).filter((p) => p.type === "link");

describe("splitLinks", () => {
  it("finds a Google Maps link and keeps the text around it", () => {
    const parts = splitLinks("Voici l'adresse : https://maps.app.goo.gl/AbC123 merci");
    expect(parts).toEqual([
      { type: "text", text: "Voici l'adresse : " },
      { type: "link", text: "https://maps.app.goo.gl/AbC123", href: "https://maps.app.goo.gl/AbC123" },
      { type: "text", text: " merci" },
    ]);
  });

  it("keeps long Google Maps URLs whole, including @ , + and query strings", () => {
    const url = "https://www.google.com/maps/place/H%C3%B4pital+Principal/@14.66,-17.43,17z/data=!3m1?entry=ttu";
    expect(links(`Here: ${url}`)).toEqual([{ type: "link", text: url, href: url }]);
  });

  it("leaves sentence punctuation after a link out of the link", () => {
    expect(links("See https://example.org/a.")[0].text).toBe("https://example.org/a");
    expect(links("(see https://example.org/a)")[0].text).toBe("https://example.org/a");
    expect(links("wiki https://en.wikipedia.org/wiki/Dakar_(city) ok")[0].text).toBe("https://en.wikipedia.org/wiki/Dakar_(city)");
  });

  it("turns www. addresses into https links", () => {
    expect(links("go to www.nomad.sn/aide")[0]).toEqual({ type: "link", text: "www.nomad.sn/aide", href: "https://www.nomad.sn/aide" });
  });

  it("never makes non-web schemes clickable", () => {
    for (const text of ["javascript:alert(1)", "data:text/html,hi", "mailto:a@b.com", "ftp://files.example.org"]) {
      expect(links(text)).toEqual([]);
    }
  });

  it("handles several links and text with none", () => {
    expect(links("a https://a.example.com b http://b.example.com")).toHaveLength(2);
    expect(splitLinks("Pas de lien ici.")).toEqual([{ type: "text", text: "Pas de lien ici." }]);
  });
});
