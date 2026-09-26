import { describe, expect, it } from "vitest";
import { notePreview } from "@/lib/notePreview";

describe("notePreview", () => {
  it("joins the lines with content, skipping headings and empty bullets", () => {
    expect(notePreview("## Call details\n- Spoke with: Awa\n-\n- Duration: 6 min\n\n## Next steps\n- Book dermatologist")).toBe(
      "Spoke with: Awa · Duration: 6 min · Book dermatologist",
    );
  });
  it("keeps plain notes as they are", () => {
    expect(notePreview("Clinique appelée : rdv mardi 10h.")).toBe("Clinique appelée : rdv mardi 10h.");
  });
  it("is empty for a note with nothing but a template's headings", () => {
    expect(notePreview("## Reason\n- \n## Next steps\n-")).toBe("");
  });
});
