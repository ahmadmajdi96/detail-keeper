"""
Realtime regression — covers both success and failure transitions.

Scenarios:
 A. dispatch -> running -> succeeded  -> cycle_run completed
 B. dispatch -> running -> failed     -> cycle_run failed

After every transition:
 - asserts the page DOM reflects the new state (realtime invalidation worked)
 - re-reads cycle_run + runner_job via Supabase REST and verifies the DB
   matches the UI (proves invalidateQueries fetched fresh data)
 - asserts the URL has not changed
 - screenshots each stage
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


async def db_get(page, table, filt):
    return await page.evaluate(
        """async ([url, anon, token, table, filt]) => {
            const q = Object.entries(filt).map(([k,v]) => `${k}=eq.${v}`).join('&');
            const r = await fetch(`${url}/rest/v1/${table}?${q}&select=*`, {
                headers: { apikey: anon, Authorization: `Bearer ${token}` },
            });
            return await r.json();
        }""",
        [SUPA, ANON, ACCESS_TOKEN, table, filt],
    )


async def shot(page, label):
    await page.screenshot(path=str(SHOTS / f"{label}.png"))


async def expect_ui_contains(page, needle, timeout=8000):
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        body = (await page.locator("body").inner_text()).lower()
        if needle.lower() in body:
            return True
        await page.wait_for_timeout(400)
    return False


async def run_scenario(page, scenario, final_callback_status, expected_cycle_status):
    print(f"\n=== Scenario {scenario}: {final_callback_status} -> {expected_cycle_status} ===")
    initial_url = page.url

    # Dispatch
    r = await call_fn(page, "runner-dispatch", {"cycle_id": CYCLE_ID, "runner_id": RUNNER_ID})
    assert r["status"] in (200, 201), f"dispatch failed: {r}"
    job = json.loads(r["body"])
    job_id = job["runner_job_id"]
    run_id = job["cycle_run_id"]
    await page.wait_for_timeout(2500)
    await shot(page, f"{scenario}_01_dispatched")

    # running
    await call_fn(page, "runner-callback", {"runner_job_id": job_id, "status": "running"})
    ok = await expect_ui_contains(page, "in_progress") or await expect_ui_contains(page, "in progress")
    assert ok, "UI never showed in_progress after running callback"
    # Verify DB matches UI (invalidateQueries → fresh fetch)
    rj = (await db_get(page, "runner_jobs", {"id": job_id}))[0]
    cr = (await db_get(page, "cycle_runs", {"id": run_id}))[0]
    assert rj["status"] == "running", f"runner_job DB mismatch: {rj['status']}"
    assert cr["status"] == "in_progress", f"cycle_run DB mismatch: {cr['status']}"
    await shot(page, f"{scenario}_02_running")

    # final callback
    payload = {"runner_job_id": job_id, "status": final_callback_status}
    if final_callback_status == "succeeded":
        payload["result"] = {"summary": {"passed": 3, "failed": 0}}
    else:
        payload["error"] = {"message": "regression: forced failure"}
        payload["result"] = {"summary": {"passed": 1, "failed": 2}}
    await call_fn(page, "runner-callback", payload)

    needle = "completed" if expected_cycle_status == "completed" else "failed"
    ok = await expect_ui_contains(page, needle)
    assert ok, f"UI never showed {needle} after {final_callback_status} callback"
    rj = (await db_get(page, "runner_jobs", {"id": job_id}))[0]
    cr = (await db_get(page, "cycle_runs", {"id": run_id}))[0]
    assert rj["status"] == final_callback_status, f"runner_job DB mismatch: {rj['status']}"
    assert cr["status"] == expected_cycle_status, f"cycle_run DB mismatch: {cr['status']}"
    await shot(page, f"{scenario}_03_{final_callback_status}")

    assert page.url == initial_url, f"page navigated! {initial_url} -> {page.url}"
    print(f"  ✅ scenario {scenario} passed")
    return {"runner_job": rj, "cycle_run": cr}


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])}, "
            f"{json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})"
        )
        await page.goto(f"{BASE}/cycles/{CYCLE_ID}", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        await shot(page, "00_initial")

        success = await run_scenario(page, "A", "succeeded", "completed")
        failure = await run_scenario(page, "B", "failed", "failed")

        report = {"scenario_A": success, "scenario_B": failure, "ok": True}
        (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str))
        print("\n✅ All realtime regression scenarios passed")
        await browser.close()


asyncio.run(main())
