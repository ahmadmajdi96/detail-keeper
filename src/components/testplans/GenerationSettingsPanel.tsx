import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersHorizontal } from "lucide-react";

export const CASE_LIMITS = [10, 25, 50, 100, 250, 500, 0] as const; // 0 = unlimited
export const limitLabel = (n: number) => (n === 0 ? "Unlimited" : String(n));

export interface GenerationSettings {
  smoke: boolean;
  regression: boolean;
  maxSmoke: number;
  maxRegression: number;
  prioritize: {
    businessValue: boolean;
    criticalFlows: boolean;
    highRisk: boolean;
    frequentlyUsed: boolean;
  };
  negativeTests: boolean;
  boundaryCases: boolean;
  duplicateDetection: boolean;
  language: "typescript" | "javascript" | "java";
}

export const DEFAULT_SETTINGS: GenerationSettings = {
  smoke: true,
  regression: true,
  maxSmoke: 25,
  maxRegression: 100,
  prioritize: { businessValue: true, criticalFlows: true, highRisk: true, frequentlyUsed: true },
  negativeTests: true,
  boundaryCases: true,
  duplicateDetection: true,
  language: "typescript",
};

/** Per-plan settings persisted locally so they survive reloads and navigation. */
export function useGenerationSettings(testPlanId: string) {
  const key = `wb-gen-settings-${testPlanId}`;
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(settings)); }, [key, settings]);
  const patch = useCallback(
    (p: Partial<GenerationSettings>) => setSettings((s) => ({ ...s, ...p })),
    [],
  );
  return { settings, setSettings, patch };
}

interface Props {
  settings: GenerationSettings;
  onChange: (patch: Partial<GenerationSettings>) => void;
  disabled?: boolean;
}

function LimitSlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  const idx = Math.max(0, CASE_LIMITS.indexOf(value as any));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Badge variant="outline" className="font-mono text-[11px]">{limitLabel(value)}</Badge>
      </div>
      <Slider
        value={[idx]}
        min={0}
        max={CASE_LIMITS.length - 1}
        step={1}
        onValueChange={([i]) => onChange(CASE_LIMITS[i])}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {CASE_LIMITS.map((n) => <span key={n}>{limitLabel(n)}</span>)}
      </div>
    </div>
  );
}

export function GenerationSettingsPanel({ settings, onChange, disabled }: Props) {
  const p = settings.prioritize;
  const setP = (k: keyof GenerationSettings["prioritize"], v: boolean) =>
    onChange({ prioritize: { ...p, [k]: v } });

  const summary = [
    settings.smoke ? `Smoke ${limitLabel(settings.maxSmoke)}` : null,
    settings.regression ? `Regression ${limitLabel(settings.maxRegression)}` : null,
  ].filter(Boolean).join(" · ") || "No test types selected";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} title="Configure AI generation">
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" /> Generation Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generation Settings</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-5 py-1">
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test types</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="gs-smoke" className="text-sm">Smoke</Label>
                <Switch id="gs-smoke" checked={settings.smoke} onCheckedChange={(v) => onChange({ smoke: v })} />
              </div>
              {settings.smoke && (
                <LimitSlider label="Maximum smoke tests" value={settings.maxSmoke} onChange={(v) => onChange({ maxSmoke: v })} />
              )}
              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="gs-reg" className="text-sm">Regression</Label>
                <Switch id="gs-reg" checked={settings.regression} onCheckedChange={(v) => onChange({ regression: v })} />
              </div>
              {settings.regression && (
                <LimitSlider label="Maximum regression tests" value={settings.maxRegression} onChange={(v) => onChange({ maxRegression: v })} />
              )}
            </section>

            <section className="space-y-2 border-t border-border/50 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioritize</p>
              {([
                ["businessValue", "High business value"],
                ["criticalFlows", "Critical user flows"],
                ["highRisk", "High risk areas"],
                ["frequentlyUsed", "Frequently used features"],
              ] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={p[k]} onCheckedChange={(v) => setP(k, !!v)} />
                  {lbl}
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">
                The AI scores every candidate test case (0–100) against these factors and only generates the highest
                scored ones when a limit is set.
              </p>
            </section>

            <section className="space-y-2 border-t border-border/50 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coverage depth</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Generate negative tests</Label>
                <Switch checked={settings.negativeTests} onCheckedChange={(v) => onChange({ negativeTests: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Boundary cases</Label>
                <Switch checked={settings.boundaryCases} onCheckedChange={(v) => onChange({ boundaryCases: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Duplicate detection</Label>
                <Switch checked={settings.duplicateDetection} onCheckedChange={(v) => onChange({ duplicateDetection: v })} />
              </div>
            </section>

            <section className="space-y-2 border-t border-border/50 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Language</Label>
                <Select value={settings.language} onValueChange={(v: any) => onChange({ language: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Framework: Playwright · Output: pages/ · tests/ · fixtures/ · utils/ · PageObjectManager
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <span className="text-[11px] text-muted-foreground mr-auto">Settings are applied to the next generation run.</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
