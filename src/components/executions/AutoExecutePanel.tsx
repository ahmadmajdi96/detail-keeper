import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Globe, Maximize2, Minimize2, Pause, Play, Radio,
  StopCircle, Terminal, X, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AutoExecMode = "api" | "browser";

export interface AutoExecItem {
  id: string;
  title: string;
  status: "queued" | "running" | "passed" | "failed";
  progress: number;          // 0-100
  logs: { t: number; line: string; kind?: "info" | "ok" | "err" | "req" }[];
  url?: string;              // for browser mode iframe focus
}

interface AutoExecutePanelProps {
  running: boolean;
  mode: AutoExecMode;
  items: AutoExecItem[];
  liveUrl?: string;          // url shown in the playwright live iframe
  onModeChange: (m: AutoExecMode) => void;
  onStop: () => void;
  onClose: () => void;
}

export function AutoExecutePanel({
  running, mode, items, liveUrl, onModeChange, onStop, onClose,
}: AutoExecutePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  const focused = items.find((i) => i.id === focusedId) ?? items[items.length - 1] ?? null;

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [focused?.logs.length]);

  const done = items.filter((i) => i.status === "passed" || i.status === "failed").length;
  const overall = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div
      className={cn(
        "transition-all",
        expanded
          ? "fixed inset-3 z-50"
          : "relative"
      )}
    >
      <Card
        className={cn(
          "border-accent/30 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 overflow-hidden",
          expanded && "h-full flex flex-col"
        )}
      >
        <CardHeader className="border-b border-border/50">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative">
                <Radio className="h-5 w-5 text-accent" />
                {running && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  Auto Execution
                  <Badge variant={running ? "default" : "secondary"} className="font-mono text-[10px]">
                    {running ? "LIVE" : "IDLE"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {items.length} test{items.length === 1 ? "" : "s"} · {done}/{items.length} complete
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tabs value={mode} onValueChange={(v) => onModeChange(v as AutoExecMode)}>
                <TabsList className="h-8">
                  <TabsTrigger value="api" className="text-xs gap-1.5"><Terminal className="h-3 w-3" />API</TabsTrigger>
                  <TabsTrigger value="browser" className="text-xs gap-1.5"><Globe className="h-3 w-3" />Browser</TabsTrigger>
                </TabsList>
              </Tabs>
              {running && (
                <Button size="sm" variant="outline" onClick={onStop} className="gap-1.5">
                  <StopCircle className="h-4 w-4" /> Stop
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse" : "Expand"}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose} title="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Progress value={overall} className="h-1.5 mt-2" />
        </CardHeader>

        <CardContent className={cn("p-0", expanded && "flex-1 min-h-0")}>
          <div className={cn(
            "grid",
            expanded
              ? "grid-cols-1 lg:grid-cols-[280px_1fr] h-full"
              : "grid-cols-1 lg:grid-cols-[280px_1fr]"
          )}>
            {/* Queue */}
            <div className="border-b lg:border-b-0 lg:border-r border-border/50">
              <ScrollArea className={cn(expanded ? "h-full" : "h-[320px]")}>
                <div className="p-2 space-y-1">
                  <AnimatePresence initial={false}>
                    {items.map((it) => (
                      <motion.button
                        key={it.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setFocusedId(it.id)}
                        className={cn(
                          "w-full text-left rounded-md border p-2 transition-colors",
                          (focused?.id === it.id)
                            ? "border-accent/60 bg-accent/10"
                            : "border-border/40 bg-muted/30 hover:bg-muted/60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <StatusDot status={it.status} />
                          <span className="text-xs font-medium truncate flex-1">{it.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{it.progress}%</span>
                        </div>
                        <Progress value={it.progress} className="h-1 mt-1.5" />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {items.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-10">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No executions yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Viewer */}
            <div className={cn("relative bg-background/40", expanded ? "min-h-0" : "")}>
              {mode === "api" ? (
                <div ref={logsRef} className={cn("font-mono text-[11px] overflow-auto bg-[#0a0f1c]", expanded ? "h-full" : "h-[320px]")}>
                  <div className="p-3 space-y-0.5">
                    {focused ? (
                      focused.logs.length === 0 ? (
                        <div className="text-muted-foreground">Waiting for first request…</div>
                      ) : (
                        focused.logs.map((l, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-muted-foreground/60 shrink-0">{fmtT(l.t)}</span>
                            <span className={cn(
                              "shrink-0 w-10",
                              l.kind === "ok" && "text-success",
                              l.kind === "err" && "text-destructive",
                              l.kind === "req" && "text-accent",
                              (!l.kind || l.kind === "info") && "text-muted-foreground",
                            )}>
                              {(l.kind ?? "info").toUpperCase()}
                            </span>
                            <span className="text-foreground/90 whitespace-pre-wrap break-all">{l.line}</span>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="text-muted-foreground p-2">Select an execution to view its log stream.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={cn("relative bg-black/60", expanded ? "h-full" : "h-[320px]")}>
                  {liveUrl ? (
                    <iframe
                      src={liveUrl}
                      title="Playwright live view"
                      className="absolute inset-0 w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                      <Globe className="h-10 w-10 text-accent/60 mb-3" />
                      <p className="text-sm font-medium">Playwright MCP live view</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md">
                        Set a target URL on the project to stream the browser session driven by the Playwright MCP server here. Use the expand button for a larger view.
                      </p>
                    </div>
                  )}
                  {focused && (
                    <div className="absolute top-2 left-2 right-2 flex items-center gap-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur border border-border/60">
                      <StatusDot status={focused.status} />
                      <span className="text-xs font-medium truncate flex-1">{focused.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{focused.progress}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {expanded && (
        <div
          className="fixed inset-0 -z-10 bg-background/70 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: AutoExecItem["status"] }) {
  if (status === "passed") return <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />;
  return <Pause className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function fmtT(t: number) {
  const d = new Date(t);
  return d.toLocaleTimeString(undefined, { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}
