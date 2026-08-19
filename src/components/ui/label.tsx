"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Mockup's uppercase micro-label pattern (matches WizardFieldLabel/KvRow),
 * the default for every field label across the app. */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-[10.5px] tracking-[0.06em] text-pn-gray-2 uppercase select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
