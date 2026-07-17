import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, Eye } from "lucide-react";
import { Logo } from "@/components/Logo";

interface Resolved {
  resource_type: string;
  resource_id: string;
  payload: any;
  expires_at: string | null;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "invalid" | "expired" | "ok">("loading");
  const [data, setData] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      const { data, error } = await supabase.rpc("resolve_share_link", { _token: token });
      if (error || !data) { setState("invalid"); return; }
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) { setState("invalid"); return; }
      if (row.status === "expired") { setState("expired"); return; }
      if (row.status === "invalid" || !row.payload) { setState("invalid"); return; }
      setData(row as Resolved);
      setState("ok");
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Watermark */}
      <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
        <span className="rotate-[-20deg] select-none text-[16vw] font-black uppercase tracking-tighter text-foreground/[0.03]">
          Shared · Read-only
        </span>
      </div>

      <header className="relative z-10 border-b border-border/50 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Logo />
          <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> Read-only share</Badge>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
        {state === "loading" && (
          <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        )}
        {state === "invalid" && (
          <Card className="border-destructive/40">
            <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> Invalid share link</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">This link does not exist or has been revoked.</p></CardContent>
          </Card>
        )}
        {state === "expired" && (
          <Card className="border-amber-500/40">
            <CardHeader><CardTitle className="flex items-center gap-2 text-amber-500"><ShieldAlert className="h-5 w-5" /> Link expired</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Ask the owner to generate a new share link.</p></CardContent>
          </Card>
        )}
        {state === "ok" && data && <SharedResourceView data={data} />}
      </main>
    </div>
  );
}

function SharedResourceView({ data }: { data: Resolved }) {
  const p = data.payload ?? {};
  return (
    <Card className="border-border/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="capitalize">{data.resource_type.replace(/_/g, " ")}: {p.name || p.title || data.resource_id.slice(0, 8)}</span>
          {data.expires_at && (
            <Badge variant="outline" className="text-[10px]">Expires {new Date(data.expires_at).toLocaleDateString()}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}

        {Array.isArray(p.metrics) && p.metrics.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {p.metrics.map((m: any, i: number) => (
              <div key={i} className="rounded-md border border-border/50 bg-card/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(p.items) && p.items.length > 0 && (
          <div className="rounded-md border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{Object.keys(p.items[0]).map((k) => <th key={k} className="px-3 py-2 text-left font-medium">{k}</th>)}</tr>
              </thead>
              <tbody>
                {p.items.map((row: any, i: number) => (
                  <tr key={i} className="border-t border-border/30">
                    {Object.values(row).map((v: any, j) => <td key={j} className="px-3 py-2">{String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground pt-4 border-t border-border/40">
          This is a read-only snapshot generated by the owner via a share link. It reflects data at the time of creation and requires no login to view.
        </p>
      </CardContent>
    </Card>
  );
}
