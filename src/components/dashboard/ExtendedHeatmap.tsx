import { useMemo } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { Panel, ML } from "@/components/sentinel/primitives";
import { Layers, Calendar, TrendingUp } from "lucide-react";

interface Exec {
  id: string;
  status: string | null;
  created_at: string;
  test_case?: { coverage_tags?: string[] | null } | null;
}

interface Props {
  executions: Exec[];
  days?: number;
}

// Heat color from pass-rate (0-100), falls back to dim cell for "no data".
function heatColor(rate: number | null, total: number) {
  if (total === 0 || rate === null) return "rgba(0,207,224,0.025)";
  if (rate >= 90) return "rgba(34,197,94,0.85)";
  if (rate >= 75) return "rgba(34,197,94,0.55)";
  if (rate >= 60) return "rgba(234,179,8,0.65)";
  if (rate >= 40) return "rgba(249,115,22,0.65)";
  return "rgba(255,48,88,0.75)";
}

export function ExtendedHeatmap({ executions, days = 14 }: Props) {
  const { matrix, tags, dayLabels, tagStats, total, peak } = useMemo(() => {
    const dayKeys: string[] = [];
    const dayLabels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      dayKeys.push(d.toISOString());
      dayLabels.push(format(d, "MMM dd"));
    }

    const tagSet = new Set<string>();
    executions.forEach((e) => {
      (e.test_case?.coverage_tags ?? []).forEach((t) => t && tagSet.add(t));
    });
    let tags = Array.from(tagSet);
    if (tags.length === 0) tags = ["uncategorized"];
    tags = tags.slice(0, 10);

    const matrix: { passed: number; total: number; rate: number | null }[][] = tags.map(() =>
      dayKeys.map(() => ({ passed: 0, total: 0, rate: null }))
    );

    executions.forEach((e) => {
      const day = startOfDay(new Date(e.created_at)).toISOString();
      const dIdx = dayKeys.indexOf(day);
      if (dIdx === -1) return;
      const cellTags = e.test_case?.coverage_tags?.length ? e.test_case.coverage_tags : ["uncategorized"];
      cellTags.forEach((t) => {
        const tIdx = tags.indexOf(t);
        if (tIdx === -1) return;
        matrix[tIdx][dIdx].total += 1;
        if (e.status === "passed") matrix[tIdx][dIdx].passed += 1;
      });
    });

    matrix.forEach((row) =>
      row.forEach((c) => {
        c.rate = c.total ? Math.round((c.passed / c.total) * 100) : null;
      })
    );

    const tagStats = tags.map((t, i) => {
      const row = matrix[i];
      const tot = row.reduce((s, c) => s + c.total, 0);
      const pass = row.reduce((s, c) => s + c.passed, 0);
      return { tag: t, total: tot, passed: pass, rate: tot ? Math.round((pass / tot) * 100) : 0 };
    });

    const total = executions.length;
    const peak = Math.max(0, ...matrix.flat().map((c) => c.total));

    return { matrix, tags, dayLabels, tagStats, total, peak };
  }, [executions, days]);

  return (
    <Panel
      title="Coverage Intelligence"
      subtitle={
        <div className="flex items-center gap-3 mt-0.5">
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="text-[#2a4060]" />
            <ML dim>{days}D × {tags.length} TAGS · {total} RUNS</ML>
          </div>
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          <ML dim>HEAT</ML>
          <div className="flex items-center gap-0.5">
            {[
              "rgba(0,207,224,0.05)",
              "rgba(255,48,88,0.75)",
              "rgba(249,115,22,0.65)",
              "rgba(234,179,8,0.65)",
              "rgba(34,197,94,0.55)",
              "rgba(34,197,94,0.85)",
            ].map((c) => (
              <div key={c} className="w-3 h-2 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <ML dim>PASS%</ML>
        </div>
      }
    >
      {total === 0 ? (
        <div className="py-12 text-center">
          <Layers className="h-8 w-8 mx-auto text-[#1e3548] mb-2" />
          <p className="sn-mono text-[10px] text-[#2a4060]">No execution data in the last {days} days</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
          {/* Heat grid */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Day header */}
              <div
                className="grid gap-1 mb-2"
                style={{ gridTemplateColumns: `140px repeat(${dayLabels.length}, minmax(28px, 1fr))` }}
              >
                <div />
                {dayLabels.map((d, i) => (
                  <div key={i} className="sn-mono text-[8px] text-[#2a4060] text-center truncate">
                    {d.split(" ")[1]}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {tags.map((tag, ti) => (
                <div
                  key={tag}
                  className="grid gap-1 mb-1 items-center"
                  style={{ gridTemplateColumns: `140px repeat(${dayLabels.length}, minmax(28px, 1fr))` }}
                >
                  <div
                    className="sn-mono text-[9px] text-[#4a6a88] truncate pr-2 text-right"
                    title={tag}
                  >
                    {tag}
                  </div>
                  {matrix[ti].map((c, di) => {
                    const intensity = peak ? Math.min(1, c.total / peak) : 0;
                    return (
                      <div
                        key={di}
                        className="relative aspect-square rounded-[3px] border border-[rgba(0,190,215,0.06)] group/cell transition-transform hover:scale-[1.18] hover:z-10"
                        style={{
                          background: heatColor(c.rate, c.total),
                          opacity: c.total === 0 ? 0.5 : 0.4 + 0.6 * intensity,
                          animation: `sn-count-up 0.4s ease-out ${(ti * 0.02 + di * 0.01).toFixed(2)}s backwards`,
                        }}
                      >
                        <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded sn-mono text-[9px] whitespace-nowrap pointer-events-none z-20 border border-[rgba(0,207,224,0.25)]"
                          style={{ background: "rgba(4,8,18,0.95)", color: "#dde8f0" }}>
                          {c.total > 0 ? `${c.rate}% · ${c.passed}/${c.total}` : "no runs"}
                          <span className="block text-[#4a6a88]">{dayLabels[di]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Tag leaderboard */}
          <div className="flex flex-col gap-2 lg:border-l lg:border-[rgba(0,190,215,0.08)] lg:pl-5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} className="text-[#00cfe0]" />
              <ML>BY TAG · PASS RATE</ML>
            </div>
            {tagStats
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((s) => {
                const col =
                  s.total === 0
                    ? "#2a4060"
                    : s.rate >= 80
                    ? "#22c55e"
                    : s.rate >= 60
                    ? "#eab308"
                    : "#ff3058";
                return (
                  <div key={s.tag} className="flex items-center gap-2">
                    <span
                      className="sn-mono text-[10px] truncate flex-1 text-[#c0d0e0]"
                      title={s.tag}
                    >
                      {s.tag}
                    </span>
                    <div className="w-20 h-[3px] bg-[#0a1a2e] rounded overflow-hidden">
                      <div
                        style={{
                          width: `${s.rate}%`,
                          height: "100%",
                          background: col,
                          boxShadow: `0 0 6px ${col}`,
                          animation: "sn-progress-bar 0.8s ease-out",
                        }}
                      />
                    </div>
                    <span
                      className="sn-mono text-[10px] w-12 text-right"
                      style={{ color: col }}
                    >
                      {s.total ? `${s.rate}%` : "—"}
                    </span>
                    <span className="sn-mono text-[9px] text-[#2a4060] w-8 text-right">
                      {s.total}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </Panel>
  );
}
