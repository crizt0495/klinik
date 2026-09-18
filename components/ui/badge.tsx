import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-[1.15rem] tracking-[0.005em] transition-colors focus:outline-none whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-border/60 bg-secondary text-secondary-foreground",
        success: "border-success/15 bg-success/12 text-[color-mix(in_oklch,var(--success)_82%,black)] dark:text-success",
        warning: "border-warning/20 bg-warning/15 text-[color-mix(in_oklch,var(--warning)_62%,black)] dark:text-warning",
        destructive: "border-destructive/15 bg-destructive/12 text-[color-mix(in_oklch,var(--destructive)_85%,black)] dark:text-destructive",
        outline: "border-border text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
