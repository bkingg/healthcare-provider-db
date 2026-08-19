"use client";

import { Tooltip } from "@base-ui/react/tooltip";

/** Hover/focus tooltip in the app's flat style. Wraps a single element (which
 * receives the trigger behaviour — pass an element that can take a ref/props,
 * e.g. a button or span). Renders the child untouched when there's no
 * `content`, so callers don't need to special-case empty text. */
export function HoverTip({ content, children }: { content?: React.ReactNode; children: React.ReactElement }) {
  if (!content) return children;
  return (
    <Tooltip.Provider delay={150}>
      <Tooltip.Root>
        <Tooltip.Trigger render={children} />
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6} className="z-[100]">
            <Tooltip.Popup className="max-w-[260px] border-2 border-pn-ink bg-white px-2.5 py-1.5 text-xs leading-snug whitespace-pre-line text-pn-ink">
              {content}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
