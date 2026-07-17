import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bug, ClipboardList, Loader2 } from "lucide-react";

/** "Assigned to me" widget: shows open defects & test-plans assigned to the current user. */
export function AssignedToMeCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [defects, setDefects] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from("defects")
          .select("id,title,severity,priority,status,project:projects(id,name)")
          .eq("assigned_to", user.id)
          .not("status", "in", "(closed,resolved)")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase.from("test_plan_assignees")
          .select("role,test_plan:test_plans(id,name,status)")
          .eq("user_id", user.id)
          .limit(5),
      ]);
      setDefects(d ?? []);
      setPlans((p ?? []).filter((r: any) => r.test_plan));
      setLoading(false);
    })();
  }, [user?.id]);

  const total = defects.length + plans.length;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Assigned to me</span>
          <Badge variant="outline" className="font-mono">{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nothing on your plate — enjoy the calm.</p>
        ) : (
          <>
            {defects.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1"><Bug className="h-3 w-3" /> Defects</div>
                <ul className="space-y-1">
                  {defects.map((d) => (
                    <li key={d.id}>
                      <Link to={`/defects/${d.id}`} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent">
                        <span className="truncate mr-2">{d.title}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{d.severity}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plans.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Test Plans</div>
                <ul className="space-y-1">
                  {plans.map((p) => (
                    <li key={p.test_plan.id}>
                      <Link to={`/test-plans/${p.test_plan.id}`} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent">
                        <span className="truncate mr-2">{p.test_plan.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{p.role}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
