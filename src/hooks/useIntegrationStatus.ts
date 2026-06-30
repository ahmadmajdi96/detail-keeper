import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type IntegrationStatus = {
  slug: string;
  status: "active" | "disconnected" | "error" | string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  name: string | null;
};

export function useIntegrationStatus(workspaceId: string | null) {
  const [byProvider, setByProvider] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setByProvider({});
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("integration_connections")
        .select("slug, status, sync_enabled, last_sync_at, last_error, name")
        .eq("workspace_id", workspaceId);
      if (cancelled) return;
      const map: Record<string, IntegrationStatus> = {};
      (data ?? []).forEach((r: any) => (map[r.slug] = r));
      setByProvider(map);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel(`int-conn-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "integration_connections", filter: `workspace_id=eq.${workspaceId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workspaceId]);

  return { byProvider, loading };
}
