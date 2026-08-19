"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

/** Thick-bordered square, matching the mockup's status/checkbox squares
 * (e.g. the results-table row checkbox) — flat, no radius, accent fill when
 * checked instead of shadcn's rounded primary-colored box. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-[15px] shrink-0 items-center justify-center rounded-none border-2 border-pn-ink bg-white transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-pn-accent data-checked:bg-pn-accent data-checked:text-white",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
