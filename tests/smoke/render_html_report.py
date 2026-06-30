"""Render /tmp/browser/smoke/report.json into a single self-contained HTML report."""
import json, os, base64
from pathlib import Path

OUT = Path(os.environ.get("SMOKE_OUT_DIR", "/tmp/browser/smoke"))
data = json.loads((OUT / "report.json").read_text())
summary = data["summary"]
routes = data["routes"]


def embed(p: Path) -> str:
    if not p.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


def status_badge(r):
    if r.get("crashed") or r.get("error"):
        return '<span style="background:#7f1d1d;color:#fecaca;padding:2px 8px;border-radius:4px">CRASH</span>'
    if r.get("console_errors"):
        return '<span style="background:#9a3412;color:#fed7aa;padding:2px 8px;border-radius:4px">ERRORS</span>'
    if r.get("new_warnings"):
        return '<span style="background:#854d0e;color:#fde68a;padding:2px 8px;border-radius:4px">WARN</span>'
    return '<span style="background:#14532d;color:#bbf7d0;padding:2px 8px;border-radius:4px">OK</span>'


rows = []
for r in routes:
    shot = embed(OUT / "shots" / r.get("screenshot", ""))
    rows.append(f"""
    <details style="border:1px solid #334155;border-radius:6px;padding:10px;margin:8px 0;background:#0f172a">
      <summary style="cursor:pointer;display:flex;gap:10px;align-items:center">
        <code style="color:#cbd5e1">{r['route']}</code>
        {status_badge(r)}
        <span style="color:#64748b;font-size:12px">errors={len(r.get('console_errors',[]))} warns={len(r.get('new_warnings',[]))} fails={len(r.get('failed_requests',[]))}</span>
      </summary>
      {'<img src="' + shot + '" style="max-width:100%;border:1px solid #1e293b;margin-top:10px"/>' if shot else ''}
      {'<h4>Console errors</h4><pre>' + '\\n'.join(r.get('console_errors',[])) + '</pre>' if r.get('console_errors') else ''}
      {'<h4>New warnings</h4><pre>' + '\\n'.join(r.get('new_warnings',[])) + '</pre>' if r.get('new_warnings') else ''}
      {'<h4>Failed requests</h4><pre>' + '\\n'.join(r.get('failed_requests',[])) + '</pre>' if r.get('failed_requests') else ''}
    </details>""")

html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Smoke Report</title>
<style>body{{font-family:system-ui;background:#020617;color:#e2e8f0;max-width:1000px;margin:24px auto;padding:0 20px}}
pre{{background:#0f172a;color:#fca5a5;padding:8px;border-radius:4px;overflow:auto;font-size:12px}}
h1,h4{{color:#f1f5f9}}</style></head>
<body>
<h1>Qualixa smoke report</h1>
<p>Routes: {summary['total_routes']} · Crashed: {summary['crashed']} · With errors: {summary['routes_with_errors']} · New warnings: {summary['routes_with_new_warnings']} · Failed reqs: {summary['routes_with_failed_requests']}</p>
{''.join(rows)}
</body></html>"""

(OUT / "report.html").write_text(html)
print(f"Wrote {OUT / 'report.html'}")
