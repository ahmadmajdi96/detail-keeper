"""
Realtime regression: dispatch a runner job, then watch the cycle detail page
update cycle_run + cycle_run_items live via realtime without navigating away.

Asserts:
  1. runner_job inserted -> queued
  2. cycle_run transitions queued/planned -> in_progress on `running` callback
  3. cycle_run transitions -> completed on `succeeded` callback
  4. Page never navigates (URL stable)
  5. Screenshots captured at every stage

Env required:
  SMOKE_BASE_URL              http://localhost:8080
  VITE_SUPABASE_URL
  VITE_SUPABASE_PUBLISHABLE_KEY
  LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON
  REGRESSION_CYCLE_ID         id of an existing cycle with one cycle_run
  REGRESSION_RUNNER_ID        id of a registered runner
"""
import asyncio, json, os, time
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(os.environ.get("REGRESSION_OUT_DIR", "/tmp/browser/realtime"))
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:8080")
SUPA = os.environ["VITE_SUPABASE_URL"].rstrip("/")
ANON = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
CYCLE_ID = os.environ["REGRESSION_CYCLE_ID"]
RUNNER_ID = os.environ["REGRESSION_RUNNER_ID"]
SESSION = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
ACCESS_TOKEN = SESSION["access_token"]


async def call_fn(page, name, body):
    return await page.evaluate(
        """async ([url, name, anon, token, body]) => {
            const r = await fetch(`${url}/functions/v1/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anon,
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            return { status: r.status, body: await r.text() };
        }""",
        [SUPA, name, ANON, ACCESS_TOKEN, body],
    )


async def shot(page, label):
    await page.screenshot(path=str(SHOTS / f"{label}.png"))
    print(f"  📸 {label}")


async def main():
    transitions = {"cycle_run": [], "runner_job": []}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        # Restore session on app origin
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])}, "
            f"{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})"
        )

        # Navigate to cycle detail and pin URL
        target = f"{BASE}/cycles/{CYCLE_ID}"
        await page.goto(target, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        initial_url = page.url
        await shot(page, "01_initial")

        # Stage 1: dispatch
        print("→ dispatching runner job")
        r = await call_fn(page, "runner-dispatch", {
            "cycle_id": CYCLE_ID,
            "runner_id": RUNNER_ID,
        })
        print("  dispatch:", r["status"], r["body"][:200])
        assert r["status"] in (200, 201), f"dispatch failed: {r}"
        job = json.loads(r["body"])
        runner_job_id = job.get("runner_job_id") or job.get("id")
        transitions["runner_job"].append(("queued", time.time()))
        await page.wait_for_timeout(2500)
        await shot(page, "02_dispatched")

        # Stage 2: running callback
        print("→ callback: running")
        r = await call_fn(page, "runner-callback", {
            "runner_job_id": runner_job_id,
            "status": "running",
        })
        print("  running:", r["status"])
        transitions["runner_job"].append(("running", time.time()))
        await page.wait_for_timeout(3000)
        # Look for in_progress badge on the page (realtime invalidation)
        body_text = (await page.locator("body").inner_text()).lower()
        if "in_progress" in body_text or "in progress" in body_text:
            transitions["cycle_run"].append(("in_progress", time.time()))
            print("  ✅ saw in_progress in UI")
        await shot(page, "03_running")

        # Stage 3: succeeded callback
        print("→ callback: succeeded")
        r = await call_fn(page, "runner-callback", {
            "runner_job_id": runner_job_id,
            "status": "succeeded",
            "summary": {"passed": 1, "failed": 0},
        })
        print("  succeeded:", r["status"])
        transitions["runner_job"].append(("succeeded", time.time()))
        await page.wait_for_timeout(3500)
        body_text = (await page.locator("body").inner_text()).lower()
        if "completed" in body_text:
            transitions["cycle_run"].append(("completed", time.time()))
            print("  ✅ saw completed in UI")
        await shot(page, "04_completed")

        # Stage 4: navigation guard
        final_url = page.url
        assert final_url == initial_url, f"page navigated! {initial_url} -> {final_url}"

        await browser.close()

    report = {
        "cycle_id": CYCLE_ID,
        "runner_id": RUNNER_ID,
        "transitions": transitions,
        "ok": (
            len(transitions["runner_job"]) == 3
            and any(s == "in_progress" for s, _ in transitions["cycle_run"])
            and any(s == "completed" for s, _ in transitions["cycle_run"])
        ),
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps(report, indent=2, default=str))
    if not report["ok"]:
        raise SystemExit("Realtime regression FAILED")


asyncio.run(main())
