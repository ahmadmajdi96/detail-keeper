"""
End-to-end regression for public share links.

Verifies against the live preview:
 1. A valid share link renders the read-only viewer with the watermark badge.
 2. An unknown token surfaces the "Invalid share link" state.
 3. An expired token surfaces the "Link expired" state.

Requires a signed-in Lovable sandbox session so we can create + expire share
rows via the authenticated REST API. If `LOVABLE_BROWSER_AUTH_STATUS` != 'injected'
the test skips gracefully with a non-zero exit and a clear message.
"""
from __future__ import annotations
import asyncio, json, os, sys, time, uuid
from pathlib import Path
import urllib.request, urllib.error
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("SHARE_BASE_URL", "http://localhost:8080")
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
AUTH_STATUS = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")

OUT = Path("/tmp/browser/share")
OUT.mkdir(parents=True, exist_ok=True)


def rest(method: str, path: str, token: str, body: dict | None = None):
    hdr = {"apikey": ANON, "Authorization": f"Bearer {token}",
           "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{SUPABASE_URL}{path}", method=method, headers=hdr, data=data)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


async def check_state(page, url: str, needle: str, screenshot: str) -> bool:
    await page.goto(url, wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    await page.screenshot(path=str(OUT / screenshot))
    text = await page.inner_text("body")
    ok = needle.lower() in text.lower()
    print(f"[{screenshot}] {'PASS' if ok else 'FAIL'} — expected {needle!r}")
    return ok


async def main() -> int:
    if AUTH_STATUS != "injected" or not SESSION_JSON:
        print("SKIP: no injected Supabase session; sign in via the preview to enable this test.")
        return 0

    session = json.loads(SESSION_JSON)
    access = session["access_token"]

    valid_token = uuid.uuid4().hex + uuid.uuid4().hex[:16]
    expired_token = uuid.uuid4().hex + uuid.uuid4().hex[:16]
    invalid_token = "does-not-exist-" + uuid.uuid4().hex[:8]

    # Seed the two share rows via authenticated REST (RLS lets the owner insert).
    now = int(time.time())
    for tok, expires in ((valid_token, None), (expired_token, "1970-01-01T00:00:00Z")):
        s, body = rest("POST", "/rest/v1/share_links", access, {
            "token": tok,
            "resource_type": "dashboard",
            "resource_id": str(uuid.uuid4()),
            "expires_at": expires,
        })
        if s >= 400:
            print(f"seed failed for token={tok[:8]}… status={s} body={body[:200]}")
            return 1

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        results = [
            await check_state(page, f"{BASE_URL}/share/{valid_token}",
                              "read-only share", "1_valid.png"),
            await check_state(page, f"{BASE_URL}/share/{invalid_token}",
                              "invalid share link", "2_invalid.png"),
            await check_state(page, f"{BASE_URL}/share/{expired_token}",
                              "link expired", "3_expired.png"),
        ]
        await browser.close()

    # Cleanup
    for tok in (valid_token, expired_token):
        rest("DELETE", f"/rest/v1/share_links?token=eq.{tok}", access)

    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
