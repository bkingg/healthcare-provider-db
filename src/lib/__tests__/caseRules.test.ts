import { describe, expect, it } from "vitest";
import { findUrgentPhrases, initialRag } from "@/lib/caseRules";
import { formatCaseNumber } from "@/lib/caseNumber";

const routine = { urgency: "ROUTINE" as const, categoryCode: "FIND_DOCTOR", description: "I need a dermatologist for a rash.", hasLocation: true };

describe("initialRag", () => {
  it("is GREEN for a routine request with a location", () => {
    expect(initialRag(routine)).toEqual({ rag: "GREEN", reasons: [] });
  });

  it("is RED when the member says it's an emergency", () => {
    expect(initialRag({ ...routine, urgency: "EMERGENCY" })).toEqual({ rag: "RED", reasons: ["MEMBER_SAID_EMERGENCY"] });
  });

  it("is RED on urgent words, in French or English, even if the member chose routine", () => {
    expect(initialRag({ ...routine, description: "Mon père a une douleur thoracique depuis ce matin" }).rag).toBe("RED");
    expect(initialRag({ ...routine, description: "My son is having a SEIZURE" }).reasons).toEqual(["URGENT_WORDS"]);
  });

  it("is YELLOW when help is wanted today, it's urgent care, or there's no location", () => {
    expect(initialRag({ ...routine, urgency: "TODAY" })).toEqual({ rag: "YELLOW", reasons: ["WANTED_TODAY"] });
    expect(initialRag({ ...routine, categoryCode: "URGENT_CARE" }).reasons).toEqual(["URGENT_CARE_CATEGORY"]);
    expect(initialRag({ ...routine, hasLocation: false }).reasons).toEqual(["NO_LOCATION"]);
  });
});

describe("findUrgentPhrases", () => {
  it("matches whole phrases, ignoring accents and case", () => {
    expect(findUrgentPhrases("Difficulté à respirer depuis hier")).toEqual(["difficulte a respirer"]);
    expect(findUrgentPhrases("Il a fait un AVC")).toEqual(["avc"]);
  });
  it("doesn't match inside other words", () => {
    // "avc" inside "avcx", "labor" inside "laboratory".
    expect(findUrgentPhrases("Résultats du laboratory, dossier avcx")).toEqual([]);
  });
});

describe("formatCaseNumber", () => {
  it("formats as CAS-000123", () => expect(formatCaseNumber(123)).toBe("CAS-000123"));
});

describe("escalate", () => {
  it("moves an overdue case up one colour and stops at red", async () => {
    const { escalate, ragRank } = await import("@/lib/caseRules");
    expect(escalate("GREEN")).toBe("YELLOW");
    expect(escalate("YELLOW")).toBe("RED");
    expect(escalate("RED")).toBe("RED");
    expect([ragRank("RED"), ragRank("YELLOW"), ragRank("GREEN")]).toEqual([0, 1, 2]);
  });
});

describe("parseCaseNumber", () => {
  it("reads the forms staff are likely to type", async () => {
    const { parseCaseNumber } = await import("@/lib/caseNumber");
    for (const input of ["CAS-000038", "cas-38", "CAS38", "000038", "38", " CAS-000038 "]) expect(parseCaseNumber(input)).toBe(38);
  });
  it("rejects other IDs and non-numbers", async () => {
    const { parseCaseNumber } = await import("@/lib/caseNumber");
    for (const input of ["MBR-000038", "NMD-000038", "abc", "", "CAS-", "0", "CAS-000000"]) expect(parseCaseNumber(input)).toBeNull();
  });
});
