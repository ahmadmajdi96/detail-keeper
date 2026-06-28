import { useMemo } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, TrendingUp } from "lucide-react";

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

function heatColor(rate: number | null, total: number) {
  if (total === 0 || rate === null) return "hsl(var(--muted) / 0.4)";
  if (rate >= 90) return "hsl(var(--success) / 0.9)";
  if (rate >= 75) return "hsl(var(--success) / 0.6)";
  if (rate >= 60) return "hsl(var(--warning) / 0.75)";
  if (rate >= 40) return "hsl(38 92% 50% / 0.75)";
  return "hsl(var(--destructive) / 0.8)";
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
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            Coverage Intelligence
          </CardTitle>
          <CardDescription>
            {days}-day pass rate × coverage tag · {total} runs
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">low</span>
          <div className="flex items-center gap-0.5">
            {[
              "hsl(var(--destructive) / 0.8)",
              "hsl(38 92% 50% / 0.75)",
              "hsl(var(--warning) / 0.75)",
              "hsl(var(--success) / 0.6)",
              "hsl(var(--success) / 0.9)",
            ].map((c) => (
              <div key={c} className="w-3 h-2 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">high</span>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="py-12 text-center">
            <Layers className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No execution data in the last {days} days</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
            {/* Heat grid */}
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div
                  className="grid gap-1 mb-2"
                  style={{ gridTemplateColumns: `140px repeat(${dayLabels.length}, minmax(28px, 1fr))` }}
                >
                  <div />
                  {dayLabels.map((d, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground text-center truncate">
                      {d.split(" ")[1]}
                    </div>
                  ))}
                </div>

                {tags.map((tag, ti) => (
                  <div
                    key={tag}
                    className="grid gap-1 mb-1 items-center"
                    style={{ gridTemplateColumns: `140px repeat(${dayLabels.length}, minmax(28px, 1fr))` }}
                  >
                    <div className="text-xs text-muted-foreground truncate pr-2 text-right" title={tag}>
                      {tag}
                    </div>
                    {matrix[ti].map((c, di) => {
                      const intensity = peak ? Math.min(1, c.total / peak) : 0;
                      return (
                        <div
                          key={di}
                          className="relative aspect-square rounded-[4px] border border-border/40 group/cell transition-transform hover:scale-[1.18] hover:z-10 animate-fade-in"
                          style={{
                            background: heatColor(c.rate, c.total),
                            opacity: c.total === 0 ? 0.35 : 0.5 + 0.5 * intensity,
                            animationDelay: `${(ti * 0.02 + di * 0.01).toFixed(2)}s`,
                          }}
                        >
                          <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1.5 rounded-md text-[11px] whitespace-nowrap pointer-events-none z-20 border border-border bg-popover text-popover-foreground shadow-elevated">
                            {c.total > 0 ? `${c.rate}% · ${c.passed}/${c.total}` : "no runs"}
                            <span className="block text-muted-foreground text-[10px]">{dayLabels[di]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Tag leaderboard */}
            <div className="flex flex-col gap-2.5 lg:border-l lg:border-border/50 lg:pl-6">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-foreground">By tag · pass rate</span>
              </div>
              {tagStats
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((s) => {
                  const col =
                    s.total === 0
                      ? "hsl(var(--muted-foreground))"
                      : s.rate >= 80
                      ? "hsl(var(--success))"
                      : s.rate >= 60
                      ? "hsl(var(--warning))"
                      : "hsl(var(--destructive))";
                  return (
                    <div key={s.tag} className="flex items-center gap-2">
                      <span className="text-xs truncate flex-1 text-foreground" title={s.tag}>
                        {s.tag}
                      </span>
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.rate}%`, background: col }}
                        />
                      </div>
                      <span className="text-xs font-medium w-10 text-right" style={{ color: col }}>
                        {s.total ? `${s.rate}%` : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground w-7 text-right">{s.total}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
