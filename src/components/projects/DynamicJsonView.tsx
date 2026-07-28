import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Braces, List as ListIcon, Hash, Type, ToggleLeft, Circle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  json: unknown;
  filename?: string;
}

/**
 * Renders JSON content as dynamic, interactive lists and tables — never a raw
 * text editor. Arrays of objects become tables (columns = union of keys),
 * arrays of primitives become bulleted lists, and objects become collapsible
 * key/value cards.
 */
const META_KEYS = new Set([
  "schema_version", "document_type", "job_id", "model", "provider", "repo_name",
  "root_path", "generated_from", "generated_at", "created_at", "completed_at",
  "extraction_policy", "source", "metadata",
]);

const isMetaKey = (k: string) => META_KEYS.has(k) || /_count$/.test(k) || /^count$/.test(k);

/** Split a top-level object into its real payload and its metadata envelope. */
function splitPayload(json: unknown): { payload: unknown; meta: Record<string, unknown>; payloadKey?: string } {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { payload: json, meta: {} };
  const obj = json as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isMetaKey(k)) meta[k] = v;
    else rest[k] = v;
  }
  const keys = Object.keys(rest);
  // A single remaining key that holds the content → surface it directly.
  if (keys.length === 1) return { payload: rest[keys[0]], meta, payloadKey: keys[0] };
  if (keys.length === 0) return { payload: null, meta };
  return { payload: rest, meta };
}

const prettyKey = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function DynamicJsonView({ json, filename }: Props) {
  const [query, setQuery] = useState("");
  const [showMeta, setShowMeta] = useState(false);

  const { payload, meta, payloadKey } = useMemo(() => splitPayload(json), [json]);

  const isEmptyPayload =
    payload == null ||
    (Array.isArray(payload) && payload.length === 0) ||
    (typeof payload === "object" && !Array.isArray(payload) && Object.keys(payload as any).length === 0);

  const isFilterable = useMemo(() => {
    if (Array.isArray(payload) && payload.length > 0) return true;
    if (payload && typeof payload === "object") return Object.keys(payload as any).length > 3;
    return false;
  }, [payload]);

  const hasMeta = Object.keys(meta).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Braces className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono">{filename || "data.json"}</span>
          {payloadKey && (
            <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">
              {prettyKey(payloadKey)}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">{summarize(payload)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {hasMeta && (
            <button
              onClick={() => setShowMeta((s) => !s)}
              className="text-[11px] text-muted-foreground hover:text-accent transition-colors underline-offset-2 hover:underline"
            >
              {showMeta ? "Hide metadata" : "Show metadata"}
            </button>
          )}
          {isFilterable && (
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="h-7 pl-7 text-xs w-48"
              />
            </div>
          )}
        </div>
      </div>

      {showMeta && hasMeta && (
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
          <ObjectCard obj={meta} depth={0} query="" />
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-card/40 p-3 overflow-x-auto">
        {isEmptyPayload ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No {payloadKey ? prettyKey(payloadKey).toLowerCase() : "content"} were extracted from this repository.
          </div>
        ) : (
          <Node value={payload} depth={0} query={query.toLowerCase()} />
        )}
      </div>
    </div>
  );
}

function summarize(v: unknown): string {
  if (Array.isArray(v)) return `array · ${v.length}`;
  if (v && typeof v === "object") return `object · ${Object.keys(v as any).length}`;
  return typeof v;
}

function typeIcon(v: unknown) {
  if (Array.isArray(v)) return <ListIcon className="h-3 w-3 text-cyan-400" />;
  if (v && typeof v === "object") return <Braces className="h-3 w-3 text-violet-400" />;
  if (typeof v === "number") return <Hash className="h-3 w-3 text-amber-400" />;
  if (typeof v === "boolean") return <ToggleLeft className="h-3 w-3 text-emerald-400" />;
  if (v === null) return <Circle className="h-3 w-3 text-muted-foreground" />;
  return <Type className="h-3 w-3 text-sky-400" />;
}

function Node({ value, depth, query, name }: { value: unknown; depth: number; query: string; name?: string }) {
  // Array
  if (Array.isArray(value)) {
    const allObjects = value.length > 0 && value.every((x) => x && typeof x === "object" && !Array.isArray(x));
    if (allObjects) return <ObjectTable rows={value as Record<string, unknown>[]} query={query} />;
    return (
      <ul className="space-y-1">
        {value.map((v, i) => {
          const text = String(v ?? "");
          if (query && !text.toLowerCase().includes(query)) return null;
          return (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground font-mono w-6 shrink-0">{i}</span>
              {typeIcon(v)}
              {typeof v === "object" && v !== null ? (
                <div className="flex-1"><Node value={v} depth={depth + 1} query={query} /></div>
              ) : (
                <Primitive value={v} />
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  // Object
  if (value && typeof value === "object") {
    return <ObjectCard obj={value as Record<string, unknown>} depth={depth} query={query} />;
  }

  return <Primitive value={value} />;
}

function ObjectCard({ obj, depth, query }: { obj: Record<string, unknown>; depth: number; query: string }) {
  const entries = Object.entries(obj);
  return (
    <div className={cn("space-y-1.5", depth > 0 && "pl-3 border-l border-border/40")}>
      {entries.map(([k, v]) => {
        const matches =
          !query ||
          k.toLowerCase().includes(query) ||
          (typeof v !== "object" && String(v ?? "").toLowerCase().includes(query)) ||
          (typeof v === "object" && JSON.stringify(v).toLowerCase().includes(query));
        if (!matches) return null;
        return <KVRow key={k} k={k} v={v} depth={depth} query={query} />;
      })}
    </div>
  );
}

function KVRow({ k, v, depth, query }: { k: string; v: unknown; depth: number; query: string }) {
  const complex = Array.isArray(v) || (v !== null && typeof v === "object");
  const [open, setOpen] = useState(depth < 1);

  if (!complex) {
    return (
      <div className="grid grid-cols-[minmax(140px,220px)_1fr] gap-3 items-start text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono truncate" title={k}>
          {typeIcon(v)} {k}
        </div>
        <Primitive value={v} />
      </div>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 text-xs font-mono text-foreground/90 hover:text-accent transition-colors py-0.5"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {typeIcon(v)}
        <span className="truncate">{k}</span>
        <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1">{summarize(v)}</Badge>
      </button>
      {open && (
        <div className="mt-1 ml-4">
          <Node value={v} depth={depth + 1} query={query} name={k} />
        </div>
      )}
    </div>
  );
}

function Primitive({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic text-xs">null</span>;
  if (typeof value === "boolean")
    return <Badge variant="outline" className={cn("text-[10px] h-5", value ? "text-emerald-400 border-emerald-500/40" : "text-rose-400 border-rose-500/40")}>{String(value)}</Badge>;
  if (typeof value === "number")
    return <span className="text-xs font-mono text-amber-300">{value}</span>;
  const s = String(value);
  const isUrl = /^https?:\/\//.test(s);
  const isMethod = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(s);
  if (isMethod) {
    const color = {
      GET: "text-emerald-400 border-emerald-500/40",
      POST: "text-cyan-400 border-cyan-500/40",
      PUT: "text-amber-400 border-amber-500/40",
      PATCH: "text-violet-400 border-violet-500/40",
      DELETE: "text-rose-400 border-rose-500/40",
    }[s.toUpperCase()] || "";
    return <Badge variant="outline" className={cn("text-[10px] h-5 font-mono", color)}>{s.toUpperCase()}</Badge>;
  }
  if (isUrl)
    return <a href={s} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline break-all">{s}</a>;
  return <span className="text-xs break-words whitespace-pre-wrap">{s}</span>;
}

const PAGE_SIZE = 50;
function ObjectTable({ rows, query }: { rows: Record<string, unknown>[]; query: string }) {
  const [page, setPage] = useState(0);
  const columns = useMemo(() => {
    const set = new Set<string>();
    // Sample first 200 rows to build the column set — avoids O(N*K) on huge arrays.
    for (const r of rows.slice(0, 200)) Object.keys(r).forEach((k) => set.add(k));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    // Only filter first 5000 rows to keep it responsive on massive JSON.
    const scope = rows.length > 5000 ? rows.slice(0, 5000) : rows;
    return scope.filter((r) => JSON.stringify(r).toLowerCase().includes(query));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded border border-border/50">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-8">#</th>
              {columns.map((c) => (
                <th key={c} className="text-left px-2 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const idx = safePage * PAGE_SIZE + i;
              return (
                <tr key={idx} className="border-t border-border/40 hover:bg-muted/20 align-top">
                  <td className="px-2 py-1.5 text-muted-foreground font-mono">{idx + 1}</td>
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1.5 max-w-[320px]">
                      {renderCell(row[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-2 py-4 text-center text-muted-foreground">No matching rows</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Showing {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
            {rows.length > filtered.length && !query ? "" : rows.length !== filtered.length ? ` (of ${rows.length} total)` : ""}
          </span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-0.5 rounded border border-border/60 disabled:opacity-40" onClick={() => setPage(0)} disabled={safePage === 0}>«</button>
            <button className="px-2 py-0.5 rounded border border-border/60 disabled:opacity-40" onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>Prev</button>
            <span className="px-2">Page {safePage + 1} / {totalPages}</span>
            <button className="px-2 py-0.5 rounded border border-border/60 disabled:opacity-40" onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages - 1}>Next</button>
            <button className="px-2 py-0.5 rounded border border-border/60 disabled:opacity-40" onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderCell(v: unknown) {
  if (v === undefined) return <span className="text-muted-foreground/50">—</span>;
  if (v === null) return <span className="text-muted-foreground italic">null</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">[]</span>;
    if (v.every((x) => typeof x !== "object" || x === null)) {
      return (
        <div className="flex flex-wrap gap-1">
          {v.slice(0, 8).map((x, i) => (
            <Badge key={i} variant="outline" className="text-[10px] h-5">{String(x)}</Badge>
          ))}
          {v.length > 8 && <span className="text-[10px] text-muted-foreground">+{v.length - 8}</span>}
        </div>
      );
    }
    return <details className="cursor-pointer"><summary className="text-accent text-[10px]">{v.length} items</summary><div className="mt-1"><Node value={v} depth={1} query="" /></div></details>;
  }
  if (typeof v === "object") {
    return <details className="cursor-pointer"><summary className="text-accent text-[10px]">{Object.keys(v as any).length} keys</summary><div className="mt-1"><Node value={v} depth={1} query="" /></div></details>;
  }
  return <Primitive value={v} />;
}
