import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  [
    "inline-flex h-5 items-center justify-center",
    "whitespace-nowrap rounded-md",
    "border px-1.5",
    "text-[11px] leading-none font-semibold",
    "transition-colors",
  ],
  {
    variants: {
      variant: {
        default:
          "border-primary/15 bg-primary/10 text-primary",

        secondary:
          "border-primary/15 bg-secondary text-secondary-foreground",

        destructive:
          "border-destructive/15 bg-destructive/10 text-destructive",

        success:
          "border-success/15 bg-success/10 text-success",

        warning:
          "border-warning/15 bg-warning/10 text-warning",

        outline:
          "border-border bg-background text-muted-foreground",
      },
    },

    defaultVariants: {
      variant: "secondary",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
