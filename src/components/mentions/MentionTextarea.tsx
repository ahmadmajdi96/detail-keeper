import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface MentionUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  projectId?: string | null;
  workspaceId?: string | null;
  placeholder?: string;
  rows?: number;
  onMentionsChange?: (ids: string[]) => void;
}

/**
 * Textarea with @-mention autocomplete. Populates suggestions from the
 * project's members and (as fallback) the workspace members.
 */
export function MentionTextarea({ value, onChange, projectId, workspaceId, placeholder, rows = 4, onMentionsChange }: Props) {
  const [members, setMembers] = useState<MentionUser[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const users = new Map<string, MentionUser>();
      if (projectId) {
        const { data } = await supabase
          .from("project_members")
          .select("user_id, profile:profiles!project_members_user_id_fkey(id,name,email)")
          .eq("project_id", projectId);
        (data ?? []).forEach((r: any) => {
          if (r.profile) users.set(r.profile.id, r.profile);
        });
      }
      if (workspaceId) {
        const { data } = await supabase
          .from("workspace_members")
          .select("user_id, profile:profiles!workspace_members_user_id_fkey(id,name,email)")
          .eq("workspace_id", workspaceId);
        (data ?? []).forEach((r: any) => {
          if (r.profile && !users.has(r.profile.id)) users.set(r.profile.id, r.profile);
        });
      }
      setMembers(Array.from(users.values()));
    })();
  }, [projectId, workspaceId]);

  // Re-scan mentions after each value change.
  useEffect(() => {
    if (!onMentionsChange) return;
    const ids = new Set<string>();
    const regex = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(value)) !== null) ids.add(m[2]);
    onMentionsChange(Array.from(ids));
  }, [value, onMentionsChange]);

  const filtered = members
    .filter((m) => {
      const q = query.toLowerCase();
      return !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    })
    .slice(0, 6);

  const detectMention = (v: string, caret: number) => {
    const before = v.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) return null;
    // Only trigger on whitespace-or-start prefix.
    if (at > 0 && !/\s/.test(before[at - 1])) return null;
    const frag = before.slice(at + 1);
    if (/\s/.test(frag)) return null;
    return { start: at, query: frag };
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    const caret = e.target.selectionStart ?? v.length;
    const m = detectMention(v, caret);
    if (m) { setQuery(m.query); setOpen(true); setActiveIdx(0); }
    else setOpen(false);
  };

  const pick = (u: MentionUser) => {
    const el = ref.current; if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const m = detectMention(value, caret); if (!m) { setOpen(false); return; }
    const token = `@[${u.name || u.email || "user"}](${u.id}) `;
    const next = value.slice(0, m.start) + token + value.slice(caret);
    onChange(next);
    setOpen(false);
    // restore focus
    requestAnimationFrame(() => {
      const pos = m.start + token.length;
      el.focus(); el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % filtered.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(filtered[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Write a comment… use @ to mention"}
        rows={rows}
        className="font-mono text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-64 rounded-md border bg-popover shadow-xl overflow-hidden">
          {filtered.map((u, i) => (
            <button
              type="button"
              key={u.id}
              onClick={() => pick(u)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent ${i === activeIdx ? "bg-accent" : ""}`}
            >
              <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{(u.name || u.email || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{u.name || "Unnamed"}</div>
                <div className="truncate text-[10px] text-muted-foreground">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render comment body with @mentions styled as pills. */
export function renderMentionBody(body: string) {
  const parts: React.ReactNode[] = [];
  const regex = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;
  let last = 0; let m: RegExpExecArray | null; let key = 0;
  while ((m = regex.exec(body)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{body.slice(last, m.index)}</span>);
    parts.push(
      <span key={key++} className="rounded bg-primary/15 text-primary px-1 font-medium">
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(<span key={key++}>{body.slice(last)}</span>);
  return parts;
}
