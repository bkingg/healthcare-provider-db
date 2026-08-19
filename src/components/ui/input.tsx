import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/** Flat design-system look (2px ink border, no radius, dense text) — covers
 * every <Input type="..."> variant (text/date/url/email/number/...) since
 * they all render through this one component. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[30px] w-full min-w-0 rounded-none border-2 border-pn-border-muted bg-white px-2 font-[inherit] text-[12.5px] text-pn-ink shadow-none transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-pn-ink placeholder:text-pn-gray-3 hover:border-pn-ink focus-visible:border-pn-ink focus-visible:ring-0 active:border-pn-ink disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-pn-panel disabled:opacity-60 aria-invalid:border-pn-accent",
        className
      )}
      {...props}
    />
  )
}

export { Input }
