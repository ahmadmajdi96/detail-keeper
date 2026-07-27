import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  writeBusy, readAllBusy, readStages, appendStage, clearBusy, BUSY_PREFIX,
} from "@/lib/jobBusyStore";

const PLAN_ID = "11111111-2222-3333-4444-555555555555";

const planRow = {
  id: PLAN_ID,
  name: "Checkout regression plan",
  ai_status: "running",
  ai_last_run_at: new Date().toISOString(),
  ai_progress: 42,
  ai_progress_message: "Generating test cases (42%)",
  ai_progress_updated_at: new Date().toISOString(),
  codegen_status: null,
  codegen_last_run_at: null,
  codegen_progress: null,
  codegen_progress_message: null,
  codegen_progress_updated_at: null,
};

const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    limit: () => Promise.resolve({ data: [], error: null }),
    in: () => Promise.resolve({ data: [planRow], error: null }),
  };
  return {
    supabase: {
      from: () => builder,
      functions: { invoke: (...a: any[]) => invoke(...a) },
    },
  };
});

vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: () => true, role: "lead" }) }));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), {
  success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
}) }));

import { GenerationJobTracker } from "@/components/testplans/GenerationJobTracker";

function renderTracker() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GenerationJobTracker />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("job tracking survives navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockClear();
    cleanup();
  });

  it("keeps the busy entry and stage log in storage across unmount/remount", async () => {
    writeBusy(PLAN_ID, { kind: "cases", startedAt: Date.now() });

    const first = renderTracker();
    await waitFor(() => expect(first.getByTestId("job-tracker-panel")).toBeTruthy());
    await waitFor(() => expect(readStages(PLAN_ID).length).toBeGreaterThan(0));
    const callsBefore = invoke.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);

    // Simulate navigating away from the page that mounted the tracker.
    first.unmount();
    expect(localStorage.getItem(BUSY_PREFIX + PLAN_ID)).toBeTruthy();

    // …and coming back: the job is re-adopted and polling resumes.
    const second = renderTracker();
    await waitFor(() => expect(second.getByTestId("job-tracker-panel")).toBeTruthy());
    await waitFor(() => expect(invoke.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(second.getByText("Checkout regression plan")).toBeTruthy();
    expect(readStages(PLAN_ID).length).toBeGreaterThan(0);
  });

  it("de-duplicates identical consecutive stage events and clears on completion", () => {
    appendStage(PLAN_ID, { stage: "cases", message: "Generating test cases (10%)" });
    appendStage(PLAN_ID, { stage: "cases", message: "Generating test cases (10%)" });
    expect(readStages(PLAN_ID)).toHaveLength(1);

    appendStage(PLAN_ID, { stage: "persist", message: "Persisting 42 cases" });
    expect(readStages(PLAN_ID)).toHaveLength(2);

    writeBusy(PLAN_ID, { kind: "cases", startedAt: Date.now() });
    expect(Object.keys(readAllBusy())).toContain(PLAN_ID);
    clearBusy(PLAN_ID);
    expect(Object.keys(readAllBusy())).not.toContain(PLAN_ID);
  });
});
