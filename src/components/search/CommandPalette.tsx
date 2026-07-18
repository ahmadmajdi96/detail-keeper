import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bug,
  FileText,
  FolderKanban,
  Layers,
  ClipboardList,
  Building2,
  Rocket,
  Settings,
  Users,
  BarChart3,
  Sparkles,
  Search as SearchIcon,
} from "lucide-react";

type Hit = {
  id: string;
  kind: "defect" | "test_plan" | "test_case" | "project" | "workspace" | "document";
  title: string;
  subtitle?: string;
  path: string;
  updated_at?: string;
};

const kindIcon: Record<Hit["kind"], any> = {
  defect: Bug,
  test_plan: ClipboardList,
  test_case: Layers,
  project: FolderKanban,
  workspace: Building2,
  document: FileText,
};

const kindLabel: Record<Hit["kind"], string> = {
  defect: "Defects",
  test_plan: "Test Plans",
  test_case: "Test Cases",
  project: "Projects",
  workspace: "Workspaces",
  document: "Documents",
};

const QUICK_ACTIONS = [
  { label: "Go to Dashboard", path: "/", icon: BarChart3 },
  { label: "Workspaces", path: "/workspaces", icon: Building2 },
  { label: "Projects", path: "/projects", icon: FolderKanban },
  { label: "Test Plans", path: "/test-plans", icon: ClipboardList },
  { label: "Test Cases", path: "/test-cases", icon: Layers },
  { label: "Defects", path: "/defects", icon: Bug },
  { label: "Releases", path: "/releases", icon: Rocket },
  { label: "AI Workbench", path: "/ai", icon: Sparkles },
  { label: "Team", path: "/team", icon: Users },
  { label: "Settings", path: "/settings", icon: Settings },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search across real tables (RLS-scoped)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const [defects, plans, cases, projects, workspaces, docs] = await Promise.all([
        supabase
          .from("defects")
          .select("id,title,severity,project_id,updated_at")
          .ilike("title", like)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("test_plans")
          .select("id,name,status,updated_at")
          .ilike("name", like)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("test_cases")
          .select("id,title,priority,updated_at")
          .ilike("title", like)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("projects")
          .select("id,name,status,updated_at")
          .ilike("name", like)
          .order("updated_at", { ascending: false })
          .limit(6),
        supabase
          .from("workspaces")
          .select("id,name,status,updated_at")
          .ilike("name", like)
          .order("updated_at", { ascending: false })
          .limit(4),
        supabase
          .from("documents")
          .select("id,filename,status,updated_at")
          .ilike("filename", like)
          .order("updated_at", { ascending: false })
          .limit(6),
      ]);

      const results: Hit[] = [];
      (defects.data || []).forEach((d: any) =>
        results.push({
          id: d.id,
          kind: "defect",
          title: d.title,
          subtitle: d.severity ? `Severity: ${d.severity}` : undefined,
          path: `/defects#defect-${d.id}`,
          updated_at: d.updated_at,
        })
      );
      (plans.data || []).forEach((p: any) =>
        results.push({
          id: p.id,
          kind: "test_plan",
          title: p.name,
          subtitle: p.status,
          path: `/test-plans/${p.id}`,
          updated_at: p.updated_at,
        })
      );
      (cases.data || []).forEach((c: any) =>
        results.push({
          id: c.id,
          kind: "test_case",
          title: c.title,
          subtitle: c.priority ? `Priority: ${c.priority}` : undefined,
          path: `/test-cases/${c.id}`,
          updated_at: c.updated_at,
        })
      );
      (projects.data || []).forEach((p: any) =>
        results.push({
          id: p.id,
          kind: "project",
          title: p.name,
          subtitle: p.status,
          path: `/projects/${p.id}`,
          updated_at: p.updated_at,
        })
      );
      (workspaces.data || []).forEach((w: any) =>
        results.push({
          id: w.id,
          kind: "workspace",
          title: w.name,
          subtitle: w.status,
          path: `/workspaces/${w.id}`,
          updated_at: w.updated_at,
        })
      );
      (docs.data || []).forEach((d: any) =>
        results.push({
          id: d.id,
          kind: "document",
          title: d.filename,
          subtitle: d.status,
          path: `/documents#document-${d.id}`,
          updated_at: d.updated_at,
        })
      );

      setHits(results);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, user?.id]);

  const grouped = useMemo(() => {
    const map: Record<string, Hit[]> = {};
    for (const h of hits) {
      (map[h.kind] ||= []).push(h);
    }
    return map;
  }, [hits]);

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    // Split path & hash
    const [p, hash] = path.split("#");
    navigate(p);
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-accent", "ring-offset-2", "rounded-md");
          setTimeout(
            () => el.classList.remove("ring-2", "ring-accent", "ring-offset-2", "rounded-md"),
            2400
          );
        }
      }, 400);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search everything — projects, plans, tests, defects, docs…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[520px]">
        {!query && (
          <CommandGroup heading="Quick actions">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem key={a.path} onSelect={() => go(a.path)} value={a.label}>
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {query && (
          <>
            {loading && (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <SearchIcon className="h-4 w-4 animate-pulse" />
                Searching…
              </div>
            )}
            {!loading && hits.length === 0 && (
              <CommandEmpty>No matches for "{query}"</CommandEmpty>
            )}
            {Object.entries(grouped).map(([kind, items], idx) => {
              const Icon = kindIcon[kind as Hit["kind"]];
              return (
                <div key={kind}>
                  {idx > 0 && <CommandSeparator />}
                  <CommandGroup heading={kindLabel[kind as Hit["kind"]]}>
                    {items.map((h) => (
                      <CommandItem
                        key={`${h.kind}-${h.id}`}
                        onSelect={() => go(h.path)}
                        value={`${h.kind}-${h.title}-${h.id}`}
                        className="group"
                      >
                        <Icon className="mr-2 h-4 w-4 text-muted-foreground group-aria-selected:text-accent" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm">{h.title}</p>
                          {h.subtitle && (
                            <p className="truncate text-xs text-muted-foreground">
                              {h.subtitle}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                          {h.kind.replace("_", " ")}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}
          </>
        )}
      </CommandList>
      <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex justify-between">
        <span>Tip: press <kbd className="rounded border px-1">↑</kbd> <kbd className="rounded border px-1">↓</kbd> to navigate</span>
        <span><kbd className="rounded border px-1">⌘</kbd> <kbd className="rounded border px-1">K</kbd> to reopen</span>
      </div>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[220px]"
        aria-label="Open command palette"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search everything…</span>
        <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px]">
          ⌘K
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
