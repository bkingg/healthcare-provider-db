import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { DoNotUseFlag } from "@/components/do-not-use-flag";
import { PnTag } from "@/components/pn-tag";
import { MarkerPin } from "@/components/map-marker-pin";

const messages = { Common: { doNotUse: "Do not use", doNotUseWarning: "DO NOT USE — this provider must not be used." } };

function renderFlag(status: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DoNotUseFlag status={status} />
    </NextIntlClientProvider>,
  );
}

describe("DoNotUseFlag", () => {
  it("shows a labelled red flag for DO_NOT_USE providers", () => {
    renderFlag("DO_NOT_USE");
    const flag = screen.getByRole("img", { name: "Do not use" });
    expect(flag.querySelector("svg")?.getAttribute("fill")).toBe("#dc2626");
  });

  it("renders nothing for any other status", () => {
    for (const status of ["ACTIVE", "SUSPENDED", "CLOSED", "INACTIVE"]) {
      const { container, unmount } = renderFlag(status);
      expect(container.innerHTML).toBe("");
      unmount();
    }
  });
});

describe("PnTag", () => {
  it("gives DO_NOT_USE its own red style, distinct from other exceptions", () => {
    const dnu = renderToStaticMarkup(<PnTag status="DO_NOT_USE" />);
    const suspended = renderToStaticMarkup(<PnTag status="SUSPENDED" />);
    expect(dnu).toContain("bg-[#dc2626]");
    expect(suspended).not.toContain("bg-[#dc2626]");
  });
});

describe("MarkerPin", () => {
  const style = { icon: "hospital", color: "#7c3aed" } as const;

  it("adds a red flag badge to DO_NOT_USE pins only", () => {
    expect(renderToStaticMarkup(<MarkerPin style={style} doNotUse />)).toContain('fill="#dc2626"');
    expect(renderToStaticMarkup(<MarkerPin style={style} />)).not.toContain("#dc2626");
  });
});
