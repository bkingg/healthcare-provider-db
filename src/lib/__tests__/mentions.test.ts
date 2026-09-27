import { describe, expect, it } from "vitest";
import { extractMentions, mentionQueryAt, splitMentions } from "../mentions";

describe("extractMentions", () => {
  it("finds handles, lowercase, once each", () => {
    expect(extractMentions("Ask @Jerome and @a.diallo, then @jerome again.")).toEqual(["jerome", "a.diallo"]);
  });
  it("ignores email addresses and too-short handles", () => {
    expect(extractMentions("Mail jean@clinic.sn or @ab")).toEqual([]);
  });
  it("stops before trailing punctuation", () => {
    expect(extractMentions("(@mariama.)")).toEqual(["mariama"]);
  });
});

describe("splitMentions", () => {
  it("cuts text into plain runs and mentions", () => {
    expect(splitMentions("Hi @jerome, call")).toEqual([{ text: "Hi " }, { handle: "jerome", raw: "@jerome" }, { text: ", call" }]);
    expect(splitMentions("@Mariama")).toEqual([{ handle: "mariama", raw: "@Mariama" }]);
  });
});

describe("mentionQueryAt", () => {
  it("returns what's typed after @ at the caret", () => {
    expect(mentionQueryAt("Ask @jer", 8)).toEqual({ query: "jer", start: 4 });
    expect(mentionQueryAt("@", 1)).toEqual({ query: "", start: 0 });
  });
  it("is null inside an email or after a space", () => {
    expect(mentionQueryAt("jean@cli", 8)).toBeNull();
    expect(mentionQueryAt("@jerome done", 12)).toBeNull();
  });
});
