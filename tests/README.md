# Tests

## Smoke (`tests/smoke/run.py`)
Loads every main route, captures console errors / failed requests / screenshots.
Outputs `report.json` + screenshots under `$SMOKE_OUT_DIR` (default `/tmp/browser/smoke`).

```bash
SMOKE_BASE_URL=http://localhost:8080 python3 tests/smoke/run.py
```

Runs in CI via `.github/workflows/smoke.yml` — artifacts uploaded as `smoke-report`.

## Realtime regression (`tests/e2e/realtime-regression.py`)
Dispatches a runner job and asserts the cycle detail page receives
`cycle_run` and `runner_job` state transitions over realtime **without
navigation**. Saves a screenshot per stage.

Required env:
- `REGRESSION_CYCLE_ID` — existing cycle with at least one `cycle_run`
- `REGRESSION_RUNNER_ID` — registered runner row
- `LOVABLE_BROWSER_SUPABASE_*` — injected by the Lovable sandbox when signed in

```bash
python3 tests/e2e/realtime-regression.py
```
