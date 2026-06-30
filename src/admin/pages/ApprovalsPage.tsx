import { useEffect, useState } from "react";
import { gql } from "../graphql/client";
import { LIST_APPROVALS, LIST_WAIVERS, UPDATE_APPROVAL } from "../graphql/operations";
import type { Approval, Connection, Waiver } from "../graphql/types";

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"approvals" | "waivers">("approvals");
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const a = await gql<{ approvalsCollection: Connection<Approval> }>(LIST_APPROVALS, { first: 100 });
      setApprovals(a.approvalsCollection.edges.map((e) => e.node));
      const w = await gql<{ waiversCollection: Connection<Waiver> }>(LIST_WAIVERS, { first: 100 });
      setWaivers(w.waiversCollection.edges.map((e) => e.node));
    } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { load(); }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    try {
      await gql(UPDATE_APPROVAL, { id, patch: { status, decided_at: new Date().toISOString() } });
      await load();
    } catch (e) { setErr(String(e)); }
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Approvals & Waivers</h1>
      <div className="mb-4 flex gap-2">
        <button className={`btn ${tab === "approvals" ? "" : "ghost"}`} onClick={() => setTab("approvals")}>Approvals</button>
        <button className={`btn ${tab === "waivers" ? "" : "ghost"}`} onClick={() => setTab("waivers")}>Waivers</button>
      </div>
      {err && <div className="admin-surface p-3 mb-3 rounded" style={{ color: "salmon" }}>{err}</div>}

      {tab === "approvals" ? (
        <div className="admin-surface rounded overflow-hidden">
          <table>
            <thead><tr><th>Subject</th><th>Status</th><th>Rationale</th><th>Requested</th><th></th></tr></thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>{a.subject_type} <span className="font-mono opacity-60">{a.subject_id.slice(0, 8)}</span></td>
                  <td><span className="badge">{a.status}</span></td>
                  <td>{a.rationale || "—"}</td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                  <td>
                    {a.status === "pending" && <>
                      <button className="btn" onClick={() => decide(a.id, "approved")}>Approve</button>{" "}
                      <button className="btn danger" onClick={() => decide(a.id, "rejected")}>Reject</button>
                    </>}
                  </td>
                </tr>
              ))}
              {!approvals.length && <tr><td colSpan={5} className="opacity-50 text-center">No approvals.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-surface rounded overflow-hidden">
          <table>
            <thead><tr><th>Scope</th><th>Reason</th><th>Expires</th><th>Created</th></tr></thead>
            <tbody>
              {waivers.map((w) => (
                <tr key={w.id}>
                  <td>{w.scope}</td><td>{w.reason || "—"}</td>
                  <td>{w.expires_at ? new Date(w.expires_at).toLocaleString() : "—"}</td>
                  <td>{new Date(w.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!waivers.length && <tr><td colSpan={4} className="opacity-50 text-center">No waivers.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
