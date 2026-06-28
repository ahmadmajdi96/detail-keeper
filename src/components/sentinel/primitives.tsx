import React, { useEffect, useState } from "react";

/**
 * Shared "Sentinel / cyan terminal" primitives used by the dashboard,
 * workspaces and projects pages. The design language is dark navy with
 * cyan #00cfe0 accent, JetBrains-Mono micro-labels and ring/bar charts.
 */

export const SENTINEL_CSS = `
  @keyframes sn-scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
  @keyframes sn-glow-breathe { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
  @keyframes sn-slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sn-slide-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes sn-count-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sn-ring-fill { from { stroke-dasharray: 0 1000; } }
  @keyframes sn-progress-bar { from { width: 0%; } }
  @keyframes sn-grid-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sn-data-stream { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
  .sn-slide-up { animation: sn-slide-up 0.4s ease-out forwards; }
  .sn-slide-right { animation: sn-slide-right 0.35s ease-out forwards; }
  .sn-count-up { animation: sn-count-up 0.5s ease-out forwards; }
  .sn-glow { animation: sn-glow-breathe 2.5s ease-in-out infinite; }
  .sn-stream {
    background: linear-gradient(90deg, transparent, #00cfe0, transparent);
    background-size: 200% 100%;
    animation: sn-data-stream 2s linear infinite;
  }
  .sn-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; }
`;

export function SentinelStyles() {
  return <style>{SENTINEL_CSS}</style>;
}

export function Scanline() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(180deg, transparent, rgba(0,207,224,0.08), transparent)",
          animation: "sn-scanline 8s linear infinite",
        }}
      />
    </div>
  );
}

export function GridBackdrop({ opacity = 0.018 }: { opacity?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        backgroundImage:
          "linear-gradient(rgba(0,207,224,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,207,224,1) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
  );
}

export function ML({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={`sn-mono text-[9px] tracking-[0.2em] uppercase ${dim ? "text-[#1e3548]" : "text-[#4a6a88]"}`}
    >
      {children}
    </span>
  );
}

export function Pill({
  label,
  color,
  bg,
  dot,
}: {
  label: string;
  color: string;
  bg: string;
  dot?: boolean;
}) {
  return (
    <span
      className="sn-mono text-[9px] tracking-widest px-2 py-0.5 rounded inline-flex items-center gap-1.5"
      style={{ color, background: bg }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full sn-glow"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      {label}
    </span>
  );
}

export function RingProgress({
  pct,
  size = 120,
  stroke = 6,
  color = "#00cfe0",
  label,
  centerText,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  centerText?: string;
}) {
  const safe = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (safe / 100) * circ;
  const cx = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(0,180,200,0.08)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ animation: "sn-ring-fill 1.1s ease-out", filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="sn-mono font-semibold text-lg" style={{ color }}>
          {centerText ?? `${Math.round(safe)}%`}
        </span>
        {label && <ML dim>{label}</ML>}
      </div>
    </div>
  );
}

export function Counter({
  value,
  color = "#dde8f0",
  size = "text-2xl",
}: {
  value: number | string;
  color?: string;
  size?: string;
}) {
  const numeric = typeof value === "number" ? value : null;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (numeric === null) return;
    let start = 0;
    const steps = 24;
    const inc = numeric / steps || 1;
    const t = setInterval(() => {
      start += inc;
      if (start >= numeric) {
        setDisplay(numeric);
        clearInterval(t);
      } else setDisplay(Math.floor(start));
    }, 28);
    return () => clearInterval(t);
  }, [numeric]);
  return (
    <span className={`sn-mono font-semibold ${size}`} style={{ color }}>
      {numeric === null ? value : display}
    </span>
  );
}

export function StatTile({
  value,
  label,
  color = "#dde8f0",
  delay = 0,
  accent,
}: {
  value: number | string;
  label: string;
  color?: string;
  delay?: number;
  accent?: string;
}) {
  return (
    <div
      className="relative px-4 py-3 rounded border border-[rgba(0,190,215,0.1)] bg-[rgba(7,14,28,0.6)] overflow-hidden sn-count-up"
      style={{ animationDelay: `${delay}s`, boxShadow: `inset 0 0 30px ${(accent ?? color)}05` }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accent ?? color, opacity: 0.4 }} />
      <Counter value={value} color={color} />
      <div className="mt-0.5">
        <ML dim>{label}</ML>
      </div>
    </div>
  );
}

export function Panel({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-lg border border-[rgba(0,190,215,0.1)] bg-[rgba(7,14,28,0.6)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <p className="font-sans text-sm font-medium text-[#dde8f0]">{title}</p>
            {subtitle && <div className="mt-0.5">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: "ACTIVE",     color: "#00cfe0", bg: "rgba(0,207,224,0.1)"  },
  ready:      { label: "READY",      color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  processing: { label: "PROCESSING", color: "#eab308", bg: "rgba(234,179,8,0.1)"  },
  pending:    { label: "PENDING",    color: "#4a6a88", bg: "rgba(74,106,136,0.12)"},
  failed:     { label: "FAILED",     color: "#ff3058", bg: "rgba(255,48,88,0.1)"  },
  blocked:    { label: "BLOCKED",    color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  review:     { label: "IN REVIEW",  color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
  completed:  { label: "COMPLETED",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  archived:   { label: "ARCHIVED",   color: "#4a6a88", bg: "rgba(74,106,136,0.12)"},
  open:       { label: "OPEN",       color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  resolved:   { label: "RESOLVED",   color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  in_progress:{ label: "RUNNING",    color: "#00cfe0", bg: "rgba(0,207,224,0.1)"  },
  passed:     { label: "PASSED",     color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
};

export function statusMeta(s?: string | null) {
  if (!s) return STATUS_META.pending;
  return STATUS_META[s] ?? { label: s.toUpperCase(), color: "#4a6a88", bg: "rgba(74,106,136,0.12)" };
}

/** Deterministic accent color from a string id (matches the cyan/purple/orange palette). */
export function colorFor(id: string) {
  const palette = ["#00cfe0", "#a855f7", "#f97316", "#22c55e", "#eab308", "#ff3058"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function StackedBar({
  segments,
  height = 28,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex rounded overflow-hidden gap-0.5" style={{ height }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <div
              key={s.label}
              className="relative group/seg transition-all duration-500"
              style={{ width: `${pct}%`, background: s.color, opacity: 0.85 }}
              title={`${s.label}: ${s.value}`}
            >
              <div className="absolute inset-0 opacity-0 group-hover/seg:opacity-100 transition-opacity flex items-center justify-center">
                <span className="sn-mono text-[9px] text-white">{Math.round(pct)}%</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
