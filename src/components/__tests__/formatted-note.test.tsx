import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FormattedNote } from "@/components/formatted-note";

describe("FormattedNote", () => {
  it("shows ## lines as headings and - lines as bullet points", () => {
    const { container } = render(<FormattedNote text={"## Call details\n- Spoke with: Awa\n- Duration: 5 min\n\n## Next steps\n- Book dermatologist"} />);
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Call details", "Next steps"]);
    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Spoke with: Awa", "Duration: 5 min", "Book dermatologist"]);
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("drops bullets a template left empty", () => {
    const { container } = render(<FormattedNote text={"## Reason\n-\n- \n- Rash"} />);
    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Rash"]);
  });

  it("keeps plain notes as paragraphs, with links clickable", () => {
    const { container } = render(<FormattedNote text={"Clinique appelée.\nPlan : https://maps.app.goo.gl/abc"} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://maps.app.goo.gl/abc");
  });

  it("never turns typed HTML into markup", () => {
    const { container } = render(<FormattedNote text={"## <img src=x onerror=alert(1)>\n- <b>bold</b>"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
