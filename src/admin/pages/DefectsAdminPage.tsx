import { useEffect, useState } from "react";
import { gql } from "../graphql/client";
import { LIST_DEFECTS, LIST_DEFECT_COMMENTS } from "../graphql/operations";
import type { Connection, Defect, DefectComment } from "../graphql/types";

export default function DefectsAdminPage() {
  const [rows, setRows] = useState<Defect[]>([]);
  const [active, setActive] = useState<Defect | null>(null);
  const [comments, setComments] = useState<DefectComment[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    gql<{ defectsCollection: Connection<Defect> }>(LIST_DEFECTS, { first: 100 })
      .then((d) => setRows(d.defectsCollection.edges.map((e) => e.node)))
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!active) return setComments([]);
    gql<{ defect_commentsCollection: Connection<DefectComment> }>(LIST_DEFECT_COMMENTS, { defectId: active.id })
      .then((d) => setComments(d.defect_commentsCollection.edges.map((e) => e.node)))
      .catch(() => setComments([]));
  }, [active]);

  return (
    <div>
      <h1 className="text-2xl mb-4">Defects</h1>
      {err && <div className="admin-surface p-3 mb-3 rounded" style={{ color: "salmon" }}>{err}</div>}
      <div className="grid grid-cols-3 gap-4">
        <div className="admin-surface rounded overflow-hidden col-span-2">
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Sev</th><th>Created</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} onClick={() => setActive(d)} style={{ cursor: "pointer" }}>
                  <td>{d.title}</td>
                  <td><span className="badge">{d.status}</span></td>
                  <td><span className="badge">{d.severity ?? "—"}</span></td>
                  <td>{new Date(d.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="opacity-50 text-center">No defects.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-surface rounded p-4">
          {active ? (
            <>
              <h2 className="text-lg mb-2">{active.title}</h2>
              <div className="text-xs opacity-60 mb-3">{active.id}</div>
              <h3 className="text-sm mb-1 admin-accent">Comments</h3>
              {comments.length ? comments.map((c) => (
                <div key={c.id} className="text-xs border-l-2 pl-2 my-2" style={{ borderColor: "hsl(var(--admin-accent))" }}>
                  <div className="opacity-60">{new Date(c.created_at).toLocaleString()}</div>
                  <div>{c.body}</div>
                </div>
              )) : <div className="opacity-50 text-xs">No comments.</div>}
            </>
          ) : <div className="opacity-50">Select a defect.</div>}
        </div>
      </div>
    </div>
  );
}
