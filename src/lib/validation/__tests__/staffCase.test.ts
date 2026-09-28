import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { staffCaseFormObject, staffCaseSchema } from "../staffCase";

const ID = "11111111-1111-4111-8111-111111111111";
const base = {
  requesterId: ID,
  patientId: ID,
  channel: "PHONE",
  contactedAt: "2026-09-28T09:00",
  categoryId: ID,
  urgency: "TODAY",
  description: "Needs a refill of blood pressure medication",
  contactPhone: "+221 77 123 45 67",
  coverage: "COVERED",
};
const codes = (input: Record<string, unknown>) => {
  const r = staffCaseSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("staffCaseSchema", () => {
  it("accepts a phone case for an existing member", () => {
    const r = staffCaseSchema.parse(base);
    expect(r.contactedAt.toISOString()).toBe("2026-09-28T09:00:00.000Z");
    expect(r.status).toBe("NEW");
    expect(r.visibleToMember).toBe(false);
  });
  it("rejects a contact time in the future or more than 30 days back", () => {
    expect(codes({ ...base, contactedAt: "2026-09-28T11:00" })).toEqual({ contactedAt: "contactedAt" });
    expect(codes({ ...base, contactedAt: "2026-08-01T09:00" })).toEqual({ contactedAt: "contactedAt" });
  });
  it("needs a member or a new person", () => {
    expect(codes({ ...base, requesterId: "", patientId: "" })).toEqual({ requesterId: "requester" });
  });
  it("only offers staff channels", () => {
    expect(codes({ ...base, channel: "MEMBER_APP" })).toHaveProperty("channel");
  });
});

describe("staffCaseFormObject", () => {
  it("turns the np_* fields into a new person and drops the member picked earlier", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(base)) fd.set(k, v);
    fd.set("addNewPerson", "1");
    fd.set("np_firstName", "Fatou");
    fd.set("np_lastName", "Sarr");
    fd.set("np_email", "Fatou.Sarr@Example.com");
    fd.set("np_isCovered", "0");
    const r = staffCaseSchema.parse(staffCaseFormObject(fd));
    expect(r.requesterId).toBeUndefined();
    expect(r.newPerson).toMatchObject({ firstName: "Fatou", lastName: "Sarr", email: "fatou.sarr@example.com", isCovered: false });
  });
  it("reports new-person problems by field", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(base)) fd.set(k, v);
    fd.set("addNewPerson", "1");
    fd.set("np_firstName", "");
    fd.set("np_lastName", "Sarr");
    fd.set("np_dateOfBirth", "2030-01-01");
    expect(codes(staffCaseFormObject(fd))).toEqual({ "newPerson.firstName": "required", "newPerson.dateOfBirth": "dateOfBirth" });
  });
});
