import { describe, expect, it } from "vitest";
import { createMemberSchema } from "@/lib/validation/members";

const base = { firstName: "Awa", lastName: "Ndiaye" };

describe("member form validation", () => {
  it("accepts a minimal primary member and applies defaults", () => {
    const r = createMemberSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ sex: "UNSPECIFIED", preferredLanguage: "fr" });
  });

  it("lowercases emails, since they're the member's sign-in identity", () => {
    expect(createMemberSchema.parse({ ...base, email: " Awa.Ndiaye@Example.COM " }).email).toBe("awa.ndiaye@example.com");
    expect(createMemberSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });

  it("requires a relationship for a dependent", () => {
    const primaryMemberId = "11111111-1111-4111-8111-111111111111";
    const r = createMemberSchema.safeParse({ ...base, primaryMemberId });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.relationshipId).toBeDefined();
    expect(createMemberSchema.safeParse({ ...base, primaryMemberId, relationshipId: "22222222-2222-4222-8222-222222222222" }).success).toBe(true);
  });

  it("rejects coverage that ends before it starts, and future birth dates", () => {
    expect(createMemberSchema.safeParse({ ...base, coverageStart: "2026-06-01", coverageEnd: "2026-01-01" }).success).toBe(false);
    expect(createMemberSchema.safeParse({ ...base, dateOfBirth: "2999-01-01" }).success).toBe(false);
  });
});

describe("member request: WhatsApp flag", () => {
  it("is on only when the switch sent 1", async () => {
    const { memberRequestSchema } = await import("@/lib/validation/memberRequest");
    const base = {
      patientId: "11111111-1111-4111-8111-111111111111",
      categoryId: "22222222-2222-4222-8222-222222222222",
      description: "Nous cherchons un pédiatre.",
      urgency: "ROUTINE",
      contactPhone: "77 123 45 67",
    };
    expect(memberRequestSchema.parse({ ...base, contactHasWhatsapp: "1" }).contactHasWhatsapp).toBe(true);
    expect(memberRequestSchema.parse({ ...base, contactHasWhatsapp: "" }).contactHasWhatsapp).toBe(false);
    expect(memberRequestSchema.parse(base).contactHasWhatsapp).toBe(false);
  });
});
