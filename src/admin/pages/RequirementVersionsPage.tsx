import { useEffect, useState } from "react";
import { gql } from "../graphql/client";
import { LIST_REQUIREMENT_VERSIONS } from "../graphql/operations";
import type { Connection, RequirementVersion } from "../graphql/types";

export default function RequirementVersionsPage() {
  const [rows, setRows] = useState<RequirementVersion[]>([]);
  const [active, setActive] = useState<RequirementVersion | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    gql<{ requirement_versionsCollection: Connection<RequirementVersion> }>(LIST_REQUIREMENT_VERSIONS, { first: 200 })
      .then((d) => setRows(d.requirement_versionsCollection.edges.map((e) => e.node)))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl mb-4">Requirement Versions</h1>
      {err && <div className="admin-surface p-3 mb-3 rounded" style={{ color: "salmon" }}>{err}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div className="admin-surface rounded overflow-hidden">
          <table>
            <thead><tr><th>Requirement</th><th>v</th><th>Created</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setActive(r)} style={{ cursor: "pointer" }}>
                  <td className="font-mono">{r.requirement_id.slice(0, 8)}</td>
                  <td><span className="badge admin-accent">v{r.version}</span></td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={3} className="opacity-50 text-center">No versions yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-surface rounded p-4">
          {active ? (
            <>
              <h2 className="text-lg mb-2">v{active.version} snapshot</h2>
              {active.change_note && <div className="opacity-70 text-xs mb-2">{active.change_note}</div>}
              <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", maxHeight: "60vh", overflow: "auto" }}>
                {JSON.stringify(active.snapshot, null, 2)}
              </pre>
            </>
          ) : <div className="opacity-50">Select a version to inspect its snapshot.</div>}
        </div>
      </div>
    </div>
  );
}
