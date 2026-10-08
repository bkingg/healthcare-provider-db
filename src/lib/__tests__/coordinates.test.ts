import { describe, expect, it } from "vitest";
import { formatDecimalCoordinates, parseCoordinates } from "@/lib/coordinates";

describe("parseCoordinates — decimal degrees", () => {
  const dakar = { lat: 14.7033, lng: -17.4635 };
  it.each([
    "14.7033, -17.4635",
    "14.7033,-17.4635",
    "14.7033 -17.4635",
    "14.7033;-17.4635",
    " 14.7033 ; -17.4635 ",
    "14,7033; -17,4635",
    "14,7033 -17,4635",
    "14.7033N 17.4635W",
    "N 14.7033, W 17.4635",
    "14.7033° N, 17.4635° W",
    "+14.7033, -17.4635",
  ])("reads %s", (input) => {
    expect(parseCoordinates(input)).toEqual(dakar);
  });
});

describe("parseCoordinates — degrees-minutes-seconds", () => {
  // 14°42'12"N 17°27'49"W = 14.703333…, -17.463611…
  const expectNear = (input: string, lat: number, lng: number) => {
    const p = parseCoordinates(input);
    expect(p).not.toBeNull();
    expect(p!.lat).toBeCloseTo(lat, 5);
    expect(p!.lng).toBeCloseTo(lng, 5);
  };
  it.each([
    `14°42'12"N 17°27'49"W`,
    `14°42'12"N, 17°27'49"W`,
    `14° 42' 12" N 17° 27' 49" W`,
    `N 14°42'12" W 17°27'49"`,
    `14°42′12″N 17°27′49″W`,
    `14º42'12''N 17º27'49''W`,
    `14 42 12 N 17 27 49 W`,
    `14°42'12" -17°27'49"`,
    `14°42'12"n 17°27'49"w`,
  ])("reads %s", (input) => expectNear(input, 14 + 42 / 60 + 12 / 3600, -(17 + 27 / 60 + 49 / 3600)));

  it("reads decimal seconds, with a point or a comma", () => {
    expectNear(`14°42'12.5"N 17°27'49.3"W`, 14 + 42 / 60 + 12.5 / 3600, -(17 + 27 / 60 + 49.3 / 3600));
    expectNear(`14°42'12,5"N; 17°27'49,3"W`, 14 + 42 / 60 + 12.5 / 3600, -(17 + 27 / 60 + 49.3 / 3600));
  });

  it("reads degrees and decimal minutes", () => {
    expectNear(`14°42.2'N 17°27.8'W`, 14 + 42.2 / 60, -(17 + 27.8 / 60));
  });

  it("reads the southern and eastern hemispheres", () => {
    expectNear(`33°55'31"S 18°25'26"E`, -(33 + 55 / 60 + 31 / 3600), 18 + 25 / 60 + 26 / 3600);
  });
});

describe("parseCoordinates — not coordinates", () => {
  it.each([
    "Sicap Amitié 2",
    "Dakar",
    "",
    "14.7033",
    "95.1, 10",
    "14.7, 190",
    "14,70, -17,46",
    "17.4635W 14.7033N",
    "villa 4025, 14",
    `14°61'12"N 17°27'49"W`,
    `14°42'60"N 17°27'49"W`,
    `17°27'49"W 14°42'12"N`,
    "14 42 12 17 27 49",
    `14.5°42'N 17°27'W`,
    `95°0'0"N 17°0'0"W`,
  ])("doesn't treat %s as coordinates", (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});

describe("formatDecimalCoordinates", () => {
  it("shows five decimals", () => {
    expect(formatDecimalCoordinates({ lat: 14.703304318, lng: -17.46349026 })).toBe("14.70330, -17.46349");
  });
});
