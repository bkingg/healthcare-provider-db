"use client";

import { usePanelWidths } from "@/lib/panel-widths";

/** Exposes the user's saved Workspace/Filters widths as CSS variables to the
 * whole app shell, so server-rendered parts (the header's brand block, the
 * Filters panel) can follow them via `w-[var(--pn-nav-w,248px)]` without
 * becoming client components themselves. An unset variable falls back to
 * each panel's own default width. */
export function PanelWidthsRoot({ className, children }: { className?: string; children: React.ReactNode }) {
  const { widths } = usePanelWidths();
  const style = {
    ...(widths.nav !== undefined && { "--pn-nav-w": `${widths.nav}px` }),
    ...(widths.filters !== undefined && { "--pn-filters-w": `${widths.filters}px` }),
  } as React.CSSProperties;
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
