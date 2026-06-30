import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type JobRow = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  progress_message: string | null;
  attempt_count: number;
  max_attempts: number;
  error: any;
  result: any;
  payload: any;
  created_at: string;
  updated_at: string;
};

export function useJob(jobId: string | null | undefined) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [loading, setLoading] = useState(!!jobId);

  useEffect(() => {
    if (!jobId) { setJob(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("jobs").select("*").eq("id", jobId).maybeSingle().then(({ data }) => {
      if (!cancelled) { setJob(data as any); setLoading(false); }
    });
    const channel = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        (payload) => { if (!cancelled) setJob(payload.new as any); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [jobId]);

  return { job, loading };
}

export function useLatestJobForPlan(planId: string | null | undefined) {
  const [jobId, setJobId] = useState<string | null>(null);
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id")
        .eq("kind", "generate_test_plan_from_docs")
        .contains("payload", { test_plan_id: planId })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setJobId((data as any)?.id || null);
    };
    load();
    const channel = supabase
      .channel(`plan-jobs-${planId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" },
        (payload) => {
          const j: any = payload.new;
          if (j?.kind === "generate_test_plan_from_docs" && j?.payload?.test_plan_id === planId) {
            if (!cancelled) setJobId(j.id);
          }
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [planId]);
  const { job, loading } = useJob(jobId);
  return { job, loading, jobId };
}
