import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const metricCardVariants = cva(
  "relative rounded-lg border p-5 transition-all duration-200 hover:shadow-soft group",
  {
    variants: {
      variant: {
        default: "bg-card border-border",
        accent: "bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20",
        success: "bg-gradient-to-br from-success/5 to-success/10 border-success/20",
        warning: "bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20",
        destructive: "bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof metricCardVariants> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  suffix?: string;
  description?: string;
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, variant, label, value, icon, trend, trendLabel, suffix, description, ...props }, ref) => {
    const trendDirection = trend && trend > 0 ? "up" : trend && trend < 0 ? "down" : "neutral";
    
    return (
      <div
        ref={ref}
        className={cn(metricCardVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">{value}</span>
              {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
            </div>
          </div>
          {icon && (
            <div className="rounded-lg bg-secondary/80 p-2.5 text-muted-foreground group-hover:bg-secondary transition-colors">
              {icon}
            </div>
          )}
        </div>
        
        {(trend !== undefined || description) && (
          <div className="mt-4 flex items-center gap-2">
            {trend !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  trendDirection === "up" && "text-success",
                  trendDirection === "down" && "text-destructive",
                  trendDirection === "neutral" && "text-muted-foreground"
                )}
              >
                {trendDirection === "up" && <TrendingUp className="h-3 w-3" />}
                {trendDirection === "down" && <TrendingDown className="h-3 w-3" />}
                {trendDirection === "neutral" && <Minus className="h-3 w-3" />}
                <span>{Math.abs(trend)}%</span>
              </div>
            )}
            {(trendLabel || description) && (
              <span className="text-xs text-muted-foreground">
                {trendLabel || description}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);
MetricCard.displayName = "MetricCard";

export { MetricCard };
