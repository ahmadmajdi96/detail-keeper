import asyncio, json, os, re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(os.environ.get("SMOKE_OUT_DIR", "/tmp/browser/smoke"))
SHOTS = OUT / "shots"
TRACES = OUT / "traces"
SHOTS.mkdir(parents=True, exist_ok=True)
TRACES.mkdir(parents=True, exist_ok=True)
REPORT = OUT / "report.json"
BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:8080")
BASELINE = json.loads(Path(__file__).with_name("baseline-warnings.json").read_text())["allow"]
ALLOW_AUTH_401 = os.environ.get("SMOKE_ALLOW_AUTH_401", "true").lower() in {"1", "true", "yes"}

AUTH_ROUTES = [
    "/dashboard", "/workspaces", "/projects", "/documents",
    "/test-plans", "/test-cases", "/test-cases/new",
    "/executions", "/releases", "/cycles", "/requirements",
    "/quality-gates", "/runners", "/defects",
    "/automation", "/reporting", "/notifications", "/settings",
    "/users", "/integrations",
]

PUBLIC_ROUTES = [
    "/", "/login", "/register", "/pricing", "/docs", "/terms",
    "/privacy", "/security", "/refunds",
]


def configured_routes():
    raw = os.environ.get("SMOKE_ROUTES", "")
    if raw.strip():
        return [route.strip() for route in re.split(r"[\s,]+", raw) if route.strip()]

    if os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON"):
        return AUTH_ROUTES

    return PUBLIC_ROUTES


ROUTES = configured_routes()


def normalize(msg: str) -> str:
    return re.sub(r"\s+", " ", msg.lower()).strip()


def is_baseline(msg: str) -> bool:
    n = normalize(msg)
    return any(allowed in n for allowed in BASELINE)


def is_allowed_error(msg: str) -> bool:
    n = normalize(msg)
    return ALLOW_AUTH_401 and "failed to load resource" in n and "status of 401" in n


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
            await init.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
        await init.close()

        for route in ROUTES:
            page = await ctx.new_page()
            errs, warns, fails = [], [], []
            page.on("pageerror", lambda e, b=errs: b.append(str(e)))

            def on_console(m, errs=errs, warns=warns):
                if m.type == "error":
                    if not is_allowed_error(m.text):
                        errs.append(m.text)
                elif m.type in ("warning", "warn"):
                    warns.append(m.text)
            page.on("console", on_console)
            page.on("requestfailed", lambda r, b=fails: b.append(f"{r.method} {r.url} -> {r.failure}"))

            slug = route.strip("/").replace("/", "_") or "root"
            trace_path = TRACES / f"{slug}.zip"
            await ctx.tracing.start(screenshots=True, snapshots=True, sources=False)
            try:
                resp = await page.goto(f"{BASE}{route}", wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(1200)
                status = resp.status if resp else 0
                crashed = await page.locator("text=Page crashed").count() > 0
                shot = SHOTS / f"{slug}.png"
                await page.screenshot(path=str(shot))
                new_warns = [w for w in warns if not is_baseline(w)]
                results.append({
                    "route": route,
                    "status": status,
                    "crashed": crashed,
                    "console_errors": errs[:10],
                    "console_warnings": warns[:10],
                    "new_warnings": new_warns[:10],
                    "failed_requests": fails[:10],
                    "screenshot": shot.name,
                    "trace": trace_path.name,
                })
            except Exception as e:
                results.append({"route": route, "error": str(e),
                                "console_errors": errs[:10], "console_warnings": warns[:10],
                                "new_warnings": [w for w in warns if not is_baseline(w)][:10]})
            finally:
                await ctx.tracing.stop(path=str(trace_path))
                await page.close()

        await browser.close()

    summary = {
        "total_routes": len(results),
        "crashed": sum(1 for r in results if r.get("crashed") or r.get("error")),
        "routes_with_errors": sum(1 for r in results if r.get("console_errors")),
        "routes_with_new_warnings": sum(1 for r in results if r.get("new_warnings")),
        "routes_with_failed_requests": sum(1 for r in results if r.get("failed_requests")),
        "all_console_errors": [e for r in results for e in r.get("console_errors", [])],
        "all_new_warnings": [w for r in results for w in r.get("new_warnings", [])],
    }
    REPORT.write_text(json.dumps({"summary": summary, "routes": results}, indent=2))

    print(f"Routes: {summary['total_routes']}")
    print(f"  crashes: {summary['crashed']}")
    print(f"  errors:  {summary['routes_with_errors']}")
    print(f"  new warnings: {summary['routes_with_new_warnings']}")
    print(f"  failed reqs: {summary['routes_with_failed_requests']}")


asyncio.run(main())
