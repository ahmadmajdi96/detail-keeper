import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        info: "bg-info/10 text-info border border-info/20",
        accent: "bg-accent/10 text-accent border border-accent/20",
        muted: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
      pulse: {
        true: "relative",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      pulse: false,
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: React.ReactNode;
  showDot?: boolean;
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant, size, pulse, icon, showDot = true, children, ...props }, ref) => {
    const dotColors = {
      default: "bg-secondary-foreground",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
      info: "bg-info",
      accent: "bg-accent",
      muted: "bg-muted-foreground",
    };

    return (
      <div
        ref={ref}
        className={cn(statusBadgeVariants({ variant, size, pulse }), className)}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              dotColors[variant || "default"],
              pulse && "animate-pulse"
            )}
          />
        )}
        {icon}
        {children}
      </div>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };
