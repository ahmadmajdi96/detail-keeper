"""
Playwright walk-through of the /admin console.
Visits each admin route, screenshots, and prints console errors.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/admin"); (OUT / "shots").mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:8080")
ROUTES = ["/admin", "/admin/repositories", "/admin/requirement-versions", "/admin/defects", "/admin/approvals", "/admin/ai-jobs"]

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        sk = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"); sj = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if sk and sj:
            await page.evaluate(f"window.localStorage.setItem({json.dumps(sk)}, {json.dumps(sj)})")
        results = []
        for route in ROUTES:
            errs = []
            page.on("pageerror", lambda e, b=errs: b.append(str(e)))
            page.on("console", lambda m, b=errs: m.type == "error" and b.append(m.text))
            await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
            await page.wait_for_timeout(800)
            slug = route.replace("/", "_").strip("_") or "root"
            await page.screenshot(path=str(OUT / "shots" / f"{slug}.png"))
            results.append({"route": route, "errors": errs[:5]})
        (OUT / "report.json").write_text(json.dumps(results, indent=2))
        await b.close()
        print("admin smoke:", json.dumps(results, indent=2))

asyncio.run(main())
