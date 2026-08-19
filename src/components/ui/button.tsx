import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** Flat design-system look: no radius, 2px borders, accent green for the
 * primary action — matches the mockup's buttons exactly (it has no separate
 * "danger" color, so `destructive` reuses the accent outline instead of a
 * red that doesn't exist anywhere else in this design). */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-none border-2 border-transparent bg-clip-padding font-[inherit] text-xs font-semibold whitespace-nowrap shadow-none transition-colors outline-none select-none focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-pn-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-pn-accent text-white hover:bg-pn-accent-hover",
        outline: "border-pn-ink bg-transparent text-pn-ink hover:bg-pn-surface-hover aria-expanded:bg-pn-surface-hover",
        secondary: "border-transparent bg-pn-rule text-pn-gray-1 hover:bg-pn-border-muted",
        ghost: "border-transparent hover:bg-pn-surface-hover hover:text-pn-ink aria-expanded:bg-pn-surface-hover",
        destructive: "border-pn-accent bg-transparent text-pn-accent hover:bg-pn-accent-soft",
        link: "border-transparent text-pn-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2 text-[11px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[11.5px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-1.5 px-3.5",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
