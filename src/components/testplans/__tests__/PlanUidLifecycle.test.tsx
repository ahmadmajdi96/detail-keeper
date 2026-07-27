import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * End-to-end coverage for the plan unique-ID (UID) lifecycle:
 *   1. create an AI test plan  -> the DB stamps a TP-XXXXXX unique ID
 *   2. the UID is rendered in the plan UI
 *   3. the UID-based deep link (/test-plans/TP-XXXXXX) resolves the same plan,
 *      with its linked documents and test cases (artifacts)
 *   4. the exported bundle manifest carries that UID and matches the UI link
 */

const PLAN_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PLAN_UID = "TP-7K3M9Q";
const OTHER_UUID = "99999999-8888-7777-6666-555555555555";

// ---- in-memory fake backend -------------------------------------------------

const db: Record<string, any[]> = {
  test_plans: [
    {
      id: OTHER_UUID,
      plan_uid: "TP-ZZZ111",
      name: "Some other plan",
      description: "Not the plan under test",
      status: "draft",
      ai_status: "idle",
    },
  ],
  test_plan_documents: [],
  test_plan_test_cases: [],
  test_plan_assignees: [],
};

let uidCounter = 0;
/** Mirrors the DB default gen_test_plan_uid(): TP- + 6 upper alphanumerics. */
function genPlanUid() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (uidCounter++ === 0) return PLAN_UID;
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TP-${out}`;
}

/** Records the filters each query applied so we can assert UID-based lookups. */
const queryLog: { table: string; filters: [string, any][] }[] = [];

function makeBuilder(table: string) {
  const filters: [string, any][] = [];
  let payload: any = null;
  let mode: "select" | "insert" = "select";

  const rows = () =>
    (db[table] ?? []).filter((r) => filters.every(([col, val]) => r[col] === val));

  const run = () => {
    queryLog.push({ table, filters: [...filters] });
    if (mode === "insert") return { data: payload, error: null };
    return { data: rows(), error: null };
  };

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => { filters.push([col, val]); return builder; },
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: (values: any) => {
      mode = "insert";
      const row = { plan_uid: genPlanUid(), ...values };
      db[table] = [...(db[table] ?? []), row];
      payload = row;
      return builder;
    },
    single: async () => {
      const r = run();
      if (mode === "insert") return r;
      const list = r.data as any[];
      return list.length
        ? { data: list[0], error: null }
        : { data: null, error: { message: "No rows found" } };
    },
    maybeSingle: async () => {
      const r = run();
      if (mode === "insert") return r;
      return { data: (r.data as any[])[0] ?? null, error: null };
    },
    then: (resolve: any) => resolve(run()),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    channel: () => {
      const ch: any = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  },
}));

// ---- trim the heavy shell so the test targets plan identity, not chrome -----

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/testplans/TestPlanWorkbench", () => ({
  TestPlanWorkbench: () => <div data-testid="workbench" />,
}));
vi.mock("@/components/testplans/PlanPeoplePanel", () => ({
  PlanPeoplePanel: () => <div />,
}));
vi.mock("@/components/testplans/TestPlanPanels", () => ({
  PlanRunnersPanel: () => <div />, PlanDefectsPanel: () => <div />,
  PlanQualityGatesPanel: () => <div />, PlanReportsPanel: () => <div />,
  PlanLivePanel: () => <div />, PlanRequirementsPanel: () => <div />,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "qa@example.com" }, profile: { id: "u1", name: "QA" } }),
}));
vi.mock("@/hooks/useProjectScope", () => ({
  useProjectScope: () => ({ projectId: null, workspaceId: null, project: null }),
}));
vi.mock("@/hooks/useJob", () => ({ useLatestJobForPlan: () => ({ data: null }) }));
vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({ can: () => true, planRole: "owner", projectRole: "lead", workspaceRole: "admin" }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { supabase } from "@/integrations/supabase/client";
import { planUidLink, validateBundleManifest } from "@/lib/exportWorkflowBundle";
import TestPlanDetailPage from "@/pages/TestPlanDetailPage";

/** Simulates the "Create AI test plan" mutation used by the plan wizard. */
async function createAiTestPlan() {
  const { data, error } = await (supabase.from("test_plans") as any)
    .insert({
      id: PLAN_UUID,
      name: "AI Checkout Regression Plan",
      description: "Generated end to end by the AI workbench",
      status: "draft",
      ai_status: "completed",
      ai_generated: true,
      created_by: "u1",
      created_at: new Date("2026-07-01T10:00:00Z").toISOString(),
      updated_at: new Date("2026-07-01T10:00:00Z").toISOString(),
      target_date: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/test-plans/:id" element={<TestPlanDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AI test plan unique ID — end to end", () => {
  beforeEach(() => {
    cleanup();
    queryLog.length = 0;
  });

  it("stamps a unique ID on creation, shows it in the UI, and resolves the UID deep link with its artifacts", async () => {
    // 1. create the plan
    const plan = await createAiTestPlan();
    expect(plan.plan_uid).toMatch(/^TP-[A-Z0-9]{6}$/);
    expect(plan.plan_uid).toBe(PLAN_UID);

    // its generated artifacts
    db.test_plan_documents.push({
      id: "d1", test_plan_id: PLAN_UUID,
      document: { id: "doc1", filename: "checkout-prd.md", mime_type: "text/markdown", status: "ready", created_at: new Date().toISOString() },
    });
    db.test_plan_test_cases.push({
      id: "c1", test_plan_id: PLAN_UUID,
      test_case: { id: "tc1", title: "Guest checkout with saved card", priority: "high", status: "active", ai_generated: true, coverage_tags: ["e2e"], created_at: new Date().toISOString() },
    });

    // 2 + 3. open the plan through its UID-based link
    renderAt(`/test-plans/${PLAN_UID}`);

    await waitFor(() => {
      expect(screen.getByText("AI Checkout Regression Plan")).toBeInTheDocument();
    });

    // the unique ID is visible in the UI
    await waitFor(() => {
      expect(screen.getAllByText((t) => t.includes(PLAN_UID)).length).toBeGreaterThan(0);
    });

    // the lookup went through plan_uid, not the raw UUID
    const planQuery = queryLog.find((q) => q.table === "test_plans");
    expect(planQuery?.filters?.[0]?.[0]).toBe("plan_uid");
    expect(planQuery?.filters?.[0]?.[1]).toBe(PLAN_UID);

    // and the linked artifacts were fetched for the resolved plan
    await waitFor(() => {
      expect(queryLog.some((q) => q.table === "test_plan_documents")).toBe(true);
      expect(queryLog.some((q) => q.table === "test_plan_test_cases")).toBe(true);
    });
  });

  it("lower-cased UID links still resolve to the same plan", async () => {
    renderAt(`/test-plans/${PLAN_UID.toLowerCase()}`);
    await waitFor(() => {
      expect(screen.getByText("AI Checkout Regression Plan")).toBeInTheDocument();
    });
    const planQuery = queryLog.find((q) => q.table === "test_plans");
    expect(planQuery?.filters?.[0]).toEqual(["plan_uid", PLAN_UID]);
  });
});

describe("Export bundle manifest validation", () => {
  const origin = "https://app.qualixa.test";
  const plan = { id: PLAN_UUID, plan_uid: PLAN_UID };
  const goodManifest = () => ({
    bundleVersion: 1,
    planUid: PLAN_UID,
    testPlan: { id: PLAN_UUID, uid: PLAN_UID, link: planUidLink(PLAN_UID, origin) },
  });

  it("accepts a manifest whose UID and link match the UI plan link", () => {
    const res = validateBundleManifest(goodManifest(), plan, planUidLink(PLAN_UID, origin));
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("rejects a manifest missing the unique ID", () => {
    const m: any = goodManifest();
    delete m.planUid;
    delete m.testPlan.uid;
    const res = validateBundleManifest(m, plan, planUidLink(PLAN_UID, origin));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/planUid is missing/);
  });

  it("rejects a manifest whose link points at a different plan than the UI link", () => {
    const m: any = goodManifest();
    m.testPlan.link = planUidLink("TP-ZZZ111", origin);
    const res = validateBundleManifest(m, plan, planUidLink(PLAN_UID, origin));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/does not match the UI plan link/);
  });

  it("rejects a manifest whose UID disagrees with the plan record", () => {
    const m: any = goodManifest();
    m.planUid = "TP-BADBAD";
    m.testPlan.uid = "TP-BADBAD";
    m.testPlan.link = planUidLink("TP-BADBAD", origin);
    const res = validateBundleManifest(m, plan, planUidLink(PLAN_UID, origin));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/does not match the plan's unique ID/);
  });
});
