import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type StatFilterCard = {
  /** Filter value applied when the card is clicked. Use "all" to reset. */
  key: string;
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  /** Tailwind gradient classes, e.g. "from-accent/20 to-transparent" */
  grad?: string;
};

/**
 * Clickable summary cards that double as filters — the same interaction the
 * Test Plans page uses, shared across every management page.
 */
export function StatFilterCards({
  cards, activeFilter, onSelect, className = "",
}: {
  cards: StatFilterCard[];
  activeFilter: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  const cols =
    cards.length >= 6 ? "lg:grid-cols-6" : cards.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`grid gap-3 grid-cols-2 md:grid-cols-3 ${cols} ${className}`}
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        const isActive = activeFilter === c.key && c.key !== "all";
        return (
          <motion.button
            key={`${c.label}-${i}`}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2 }}
            onClick={() => onSelect(isActive ? "all" : c.key)}
            title={isActive ? "Clear filter" : `Filter by ${c.label}`}
            className={`text-left rounded-lg border p-3 bg-gradient-to-br ${c.grad ?? "from-accent/20 to-transparent"} transition-all
              ${isActive ? "border-accent ring-1 ring-accent/40" : "border-border/50 hover:border-accent/40"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-2xl font-semibold">{c.value}</div>
            {c.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
