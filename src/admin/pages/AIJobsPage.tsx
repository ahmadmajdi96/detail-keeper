import { useEffect, useState } from "react";
import { gql } from "../graphql/client";
import { LIST_AI_JOBS, LIST_AI_OUTPUTS, LIST_AI_AUDIT } from "../graphql/operations";
import type { AIAuditEvent, AIJob, AIOutput, Connection } from "../graphql/types";

export default function AIJobsPage() {
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [active, setActive] = useState<AIJob | null>(null);
  const [outs, setOuts] = useState<AIOutput[]>([]);
  const [audit, setAudit] = useState<AIAuditEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    gql<{ ai_jobsCollection: Connection<AIJob> }>(LIST_AI_JOBS, { first: 100 })
      .then((d) => setJobs(d.ai_jobsCollection.edges.map((e) => e.node)))
      .catch((e) => setErr(String(e)));
    gql<{ ai_audit_eventsCollection: Connection<AIAuditEvent> }>(LIST_AI_AUDIT, { first: 50 })
      .then((d) => setAudit(d.ai_audit_eventsCollection.edges.map((e) => e.node)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return setOuts([]);
    gql<{ ai_outputsCollection: Connection<AIOutput> }>(LIST_AI_OUTPUTS, { jobId: active.id })
      .then((d) => setOuts(d.ai_outputsCollection.edges.map((e) => e.node)))
      .catch(() => setOuts([]));
  }, [active]);

  return (
    <div>
      <h1 className="text-2xl mb-4">AI Jobs</h1>
      {err && <div className="admin-surface p-3 mb-3 rounded" style={{ color: "salmon" }}>{err}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div className="admin-surface rounded overflow-hidden">
          <table>
            <thead><tr><th>Kind</th><th>Status</th><th>Model</th><th>Tokens</th><th>Cost</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} onClick={() => setActive(j)} style={{ cursor: "pointer" }}>
                  <td>{j.kind}</td>
                  <td><span className="badge">{j.status}</span></td>
                  <td>{j.model || "—"}</td>
                  <td>{(j.tokens_in ?? 0) + (j.tokens_out ?? 0)}</td>
                  <td>{j.cost_usd != null ? `$${Number(j.cost_usd).toFixed(3)}` : "—"}</td>
                </tr>
              ))}
              {!jobs.length && <tr><td colSpan={5} className="opacity-50 text-center">No AI jobs.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-surface rounded p-4">
          {active ? (
            <>
              <h2 className="text-lg mb-2">{active.kind}</h2>
              <h3 className="admin-accent text-sm">Outputs</h3>
              {outs.length ? outs.map((o) => (
                <pre key={o.id} style={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}>{JSON.stringify(o.content, null, 2)}</pre>
              )) : <div className="opacity-50 text-xs">No outputs.</div>}
            </>
          ) : <div className="opacity-50">Select a job.</div>}

          <h3 className="admin-accent text-sm mt-6">Recent Audit Events</h3>
          {audit.slice(0, 10).map((a) => (
            <div key={a.id} className="text-xs my-1 opacity-80">
              <span className="badge">{a.action}</span> <span className="opacity-60">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
