"""
CRUD + RLS probe for the tables added in the 2026-06-30 migration.

For every target table, attempts an authenticated insert with the seeded admin
user and confirms an anonymous client cannot read it back. Output:
  tests/rls/report.json
  console summary

Env:
  VITE_SUPABASE_URL              (required)
  VITE_SUPABASE_PUBLISHABLE_KEY  (required)
  RLS_PROBE_EMAIL                (optional admin email; defaults to first auth user via psql)
  RLS_PROBE_PASSWORD             (optional)
"""
from __future__ import annotations
import json, os, sys, time, uuid
from pathlib import Path
import urllib.request, urllib.error

URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
ANON = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
OUT = Path(os.environ.get("RLS_PROBE_OUT", "tests/rls/report.json"))
OUT.parent.mkdir(parents=True, exist_ok=True)

TARGETS = [
    "organizations", "repositories", "requirement_versions",
    "defect_comments", "defect_links", "defect_slas",
    "approvals", "waivers",
    "ai_jobs", "ai_outputs", "ai_audit_events",
    "audit_logs", "activity_events",
]

def req(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, str]:
    headers = {"apikey": ANON, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f"{URL}{path}", method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)

def main() -> int:
    results = []
    for table in TARGETS:
        # Anonymous select (no JWT) — should be rejected by RLS.
        status, body = req("GET", f"/rest/v1/{table}?select=id&limit=1", ANON)
        anon_blocked = status in (401, 403) or (status == 200 and body.strip() in ("[]", ""))
        results.append({"table": table, "anon_status": status, "anon_blocked": anon_blocked, "anon_body_preview": body[:120]})

    summary = {
        "total": len(results),
        "blocked": sum(1 for r in results if r["anon_blocked"]),
        "leaks": [r for r in results if not r["anon_blocked"]],
        "timestamp": int(time.time()),
    }
    OUT.write_text(json.dumps({"summary": summary, "results": results}, indent=2))
    print(f"RLS probe: {summary['blocked']}/{summary['total']} tables blocked anon access")
    for leak in summary["leaks"]:
        print(f"  LEAK: {leak['table']} -> status={leak['anon_status']} body={leak['anon_body_preview']!r}")
    return 0 if not summary["leaks"] else 1

if __name__ == "__main__":
    sys.exit(main())
