import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(os.environ.get("SMOKE_OUT_DIR", "/tmp/browser/smoke"))
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
REPORT = OUT / "report.json"
BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:8080")

ROUTES = [
    "/dashboard", "/workspaces", "/projects", "/documents",
    "/test-plans", "/test-cases", "/test-cases/new",
    "/executions", "/releases", "/cycles", "/requirements",
    "/quality-gates", "/runners", "/defects",
    "/automation", "/reporting", "/notifications", "/settings",
    "/users", "/integrations",
]

async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        init = await ctx.new_page()
        await init.goto(BASE, wait_until="domcontentloaded")
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if storage_key and session_json:
            await init.evaluate(f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})")
        await init.close()


        for route in ROUTES:
            page = await ctx.new_page()
            errs, fails = [], []
            page.on("pageerror", lambda e, b=errs: b.append(str(e)))
            page.on("console", lambda m, b=errs: m.type == "error" and b.append(m.text))
            page.on("requestfailed", lambda r, b=fails: b.append(f"{r.method} {r.url} -> {r.failure}"))
            try:
                resp = await page.goto(f"http://localhost:8080{route}", wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(1200)
                status = resp.status if resp else 0
                # Crash detection
                crashed = await page.locator("text=Page crashed").count() > 0
                shot = SHOTS / f"{route.strip('/').replace('/', '_') or 'root'}.png"
                await page.screenshot(path=str(shot))
                results.append({
                    "route": route, "status": status, "crashed": crashed,
                    "console_errors": errs[:5], "failed_requests": fails[:5],
                    "screenshot": str(shot.name),
                })
            except Exception as e:
                results.append({"route": route, "error": str(e), "console_errors": errs[:5]})
            
            
            

        await browser.close()
    REPORT.write_text(json.dumps(results, indent=2))
    bad = [r for r in results if r.get("crashed") or r.get("error") or r.get("console_errors")]
    print(f"Routes: {len(results)}, problematic: {len(bad)}")
    for r in bad:
        print(f"  {r['route']}: crashed={r.get('crashed')} err={r.get('error')} console={len(r.get('console_errors',[]))}")

asyncio.run(main())
