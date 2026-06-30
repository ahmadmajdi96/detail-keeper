import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "repositories", "requirement_versions", "defects", "approvals",
  "waivers", "ai_jobs", "ai_outputs", "ai_audit_events", "audit_logs",
] as const;

export default function AdminOverviewPage() {
  const [counts, setCounts] = useState<Record<string, number | string>>({});

  useEffect(() => {
    (async () => {
      const next: Record<string, number | string> = {};
      await Promise.all(TABLES.map(async (t) => {
        const { count, error } = await supabase.from(t as never).select("*", { count: "exact", head: true });
        next[t] = error ? "—" : count ?? 0;
      }));
      setCounts(next);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl mb-1">Admin Console</h1>
      <p className="opacity-60 text-sm mb-6">
        Isolated control plane for the new schema. Driven by the pg_graphql endpoint.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {TABLES.map((t) => (
          <div key={t} className="admin-surface p-4 rounded">
            <div className="text-xs uppercase opacity-60">{t}</div>
            <div className="text-2xl admin-accent mt-1">{counts[t] ?? "…"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
