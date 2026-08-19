import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full min-w-0 [overflow-wrap:anywhere] rounded-none border-2 border-pn-border-muted bg-white px-2 py-1.5 font-[inherit] text-[12.5px] text-pn-ink shadow-none transition-colors outline-none placeholder:text-pn-gray-3 hover:border-pn-ink focus-visible:border-pn-ink focus-visible:ring-0 active:border-pn-ink disabled:cursor-not-allowed disabled:bg-pn-panel disabled:opacity-60 aria-invalid:border-pn-accent",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
