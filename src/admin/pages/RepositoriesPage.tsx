import { useEffect, useState } from "react";
import { gql } from "../graphql/client";
import { LIST_REPOSITORIES, INSERT_REPOSITORY, DELETE_REPOSITORY } from "../graphql/operations";
import type { Connection, Repository } from "../graphql/types";
import { supabase } from "@/integrations/supabase/client";

export default function RepositoriesPage() {
  const [rows, setRows] = useState<Repository[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", provider: "github", default_branch: "main", workspace_id: "" });
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    try {
      const data = await gql<{ repositoriesCollection: Connection<Repository> }>(LIST_REPOSITORIES, { first: 100 });
      setRows(data.repositoriesCollection.edges.map((e) => e.node));
      setErr(null);
    } catch (e) { setErr(String(e)); }
  }

  useEffect(() => {
    load();
    supabase.from("workspaces").select("id,name").then(({ data }) => {
      setWorkspaces(data ?? []);
      if (data?.[0]) setForm((f) => ({ ...f, workspace_id: data[0].id }));
    });
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await gql(INSERT_REPOSITORY, { obj: form });
      setForm((f) => ({ ...f, name: "", url: "" }));
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete repository?")) return;
    try { await gql(DELETE_REPOSITORY, { id }); await load(); }
    catch (e) { setErr(String(e)); }
  }

  return (
    <div>
      <h1 className="text-2xl mb-4">Repositories</h1>
      <form onSubmit={onCreate} className="admin-surface p-4 rounded mb-6 grid grid-cols-5 gap-3 items-end">
        <label>Workspace<select value={form.workspace_id} onChange={(e) => setForm({ ...form, workspace_id: e.target.value })}>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select></label>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>URL<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required /></label>
        <label>Provider<input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></label>
        <button className="btn" disabled={busy || !form.workspace_id}>{busy ? "…" : "Add Repository"}</button>
      </form>

      {err && <div className="admin-surface p-3 rounded mb-4 text-sm" style={{ color: "salmon" }}>{err}</div>}

      <div className="admin-surface rounded overflow-hidden">
        <table>
          <thead><tr><th>Name</th><th>Provider</th><th>URL</th><th>Branch</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td><td><span className="badge">{r.provider}</span></td>
                <td><a href={r.url} target="_blank" rel="noreferrer">{r.url}</a></td>
                <td>{r.default_branch || "—"}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td><button className="btn danger" onClick={() => onDelete(r.id)}>Delete</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="opacity-50 text-center">No repositories yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
