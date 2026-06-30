// Normalized parsers for CI test result formats.
// Output shape:
//   { suite: string, name: string, full_name: string, status: 'passed'|'failed'|'skipped'|'blocked',
//     duration_ms: number, error?: { message?: string, stack?: string, signature?: string },
//     attachments?: { kind: string, ref: string }[] }

export type NormalizedTest = {
  suite: string;
  name: string;
  full_name: string;
  status: "passed" | "failed" | "skipped" | "blocked";
  duration_ms: number;
  error?: { message?: string; stack?: string; signature?: string };
  attachments?: { kind: string; ref: string }[];
};

function errSignature(msg?: string) {
  if (!msg) return undefined;
  return msg.replace(/\s+/g, " ").trim().slice(0, 200);
}

// JUnit XML parser (tolerant, no external deps)
export function parseJUnitXml(xml: string): NormalizedTest[] {
  const tests: NormalizedTest[] = [];
  const suiteRe = /<testsuite\b[^>]*?name="([^"]*)"[^>]*>([\s\S]*?)<\/testsuite>/g;
  const caseRe = /<testcase\b([^>]*?)\/>|<testcase\b([^>]*?)>([\s\S]*?)<\/testcase>/g;
  const attr = (s: string, n: string) => {
    const m = s.match(new RegExp(`${n}="([^"]*)"`));
    return m ? m[1] : "";
  };
  let sm: RegExpExecArray | null;
  // Handle single rootless testcase docs too
  const wrapped = xml.includes("<testsuite") ? xml : `<testsuite name="default">${xml}</testsuite>`;
  while ((sm = suiteRe.exec(wrapped))) {
    const suiteName = sm[1] || "default";
    const body = sm[2];
    let cm: RegExpExecArray | null;
    const caseRe2 = new RegExp(caseRe.source, "g");
    while ((cm = caseRe2.exec(body))) {
      // group 1 = attrs from self-closing form; group 2/3 = attrs/body from full form
      const attrs = cm[1] !== undefined ? cm[1] : (cm[2] || "");
      const inner = cm[3] || "";
      const name = attr(attrs, "name");
      const className = attr(attrs, "classname");
      const time = parseFloat(attr(attrs, "time") || "0");
      let status: NormalizedTest["status"] = "passed";
      let message: string | undefined;
      let stack: string | undefined;
      if (/<skipped/.test(inner)) status = "skipped";
      const failMatch = inner.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>|<(failure|error)\b([^>]*)\/>/);
      if (failMatch) {
        status = "failed";
        const fAttrs = failMatch[2] || failMatch[5] || "";
        message = attr(fAttrs, "message") || undefined;
        stack = (failMatch[3] || "").trim() || undefined;
      }
      tests.push({
        suite: suiteName,
        name,
        full_name: className ? `${className}.${name}` : `${suiteName}.${name}`,
        status,
        duration_ms: Math.round((isFinite(time) ? time : 0) * 1000),
        error: status === "failed" ? { message, stack, signature: errSignature(message || stack) } : undefined,
      });
    }
  }
  return tests;
}

// Playwright JSON (playwright reporter "json")
export function parsePlaywrightJson(json: any): NormalizedTest[] {
  const out: NormalizedTest[] = [];
  const walk = (suite: any, path: string[] = []) => {
    const title = suite.title || "";
    const nextPath = title ? [...path, title] : path;
    for (const t of suite.tests || []) {
      const results = t.results || [];
      const last = results[results.length - 1] || {};
      const status = last.status === "passed" ? "passed"
        : last.status === "skipped" ? "skipped"
        : last.status === "timedOut" || last.status === "failed" ? "failed"
        : "blocked";
      out.push({
        suite: nextPath.join(" > ") || "playwright",
        name: t.title || "test",
        full_name: [...nextPath, t.title].filter(Boolean).join(" > "),
        status,
        duration_ms: last.duration || 0,
        error: status === "failed" ? {
          message: last.error?.message,
          stack: last.error?.stack,
          signature: errSignature(last.error?.message),
        } : undefined,
        attachments: (last.attachments || []).map((a: any) => ({ kind: a.contentType || "file", ref: a.path || a.name })),
      });
    }
    for (const s of suite.suites || []) walk(s, nextPath);
  };
  for (const s of json.suites || []) walk(s);
  return out;
}

// Allure (allure-report JSON results: directory of *-result.json). Accepts an array.
export function parseAllureResults(results: any[]): NormalizedTest[] {
  return (results || []).map((r) => {
    const status = r.status === "passed" ? "passed"
      : r.status === "skipped" ? "skipped"
      : r.status === "failed" || r.status === "broken" ? "failed"
      : "blocked";
    return {
      suite: r.labels?.find((l: any) => l.name === "suite")?.value || "allure",
      name: r.name || "test",
      full_name: r.fullName || r.name || "test",
      status,
      duration_ms: (r.stop || 0) - (r.start || 0),
      error: status === "failed" ? {
        message: r.statusDetails?.message,
        stack: r.statusDetails?.trace,
        signature: errSignature(r.statusDetails?.message),
      } : undefined,
      attachments: (r.attachments || []).map((a: any) => ({ kind: a.type || "file", ref: a.source })),
    } as NormalizedTest;
  });
}

// Cypress JSON (mocha-style)
export function parseCypressJson(json: any): NormalizedTest[] {
  const out: NormalizedTest[] = [];
  const walk = (suite: any, path: string[] = []) => {
    const title = suite.title || "";
    const nextPath = title ? [...path, title] : path;
    for (const t of suite.tests || []) {
      const state = t.state || (t.fail ? "failed" : t.pass ? "passed" : t.pending ? "skipped" : "blocked");
      const status: NormalizedTest["status"] =
        state === "passed" ? "passed" : state === "failed" ? "failed" : state === "pending" ? "skipped" : "blocked";
      out.push({
        suite: nextPath.join(" > ") || "cypress",
        name: t.title || t.fullTitle || "test",
        full_name: t.fullTitle || [...nextPath, t.title].filter(Boolean).join(" > "),
        status,
        duration_ms: t.duration || 0,
        error: status === "failed" ? { message: t.err?.message, stack: t.err?.estack, signature: errSignature(t.err?.message) } : undefined,
      });
    }
    for (const s of suite.suites || []) walk(s, nextPath);
  };
  if (json.results) for (const r of json.results) walk(r);
  if (json.suites) walk(json);
  return out;
}

export function detectAndParse(content: string): { framework: string; tests: NormalizedTest[] } {
  const trimmed = content.trim();
  if (trimmed.startsWith("<")) return { framework: "junit", tests: parseJUnitXml(content) };
  try {
    const json = JSON.parse(content);
    if (Array.isArray(json) && json[0]?.uuid && (json[0]?.status || json[0]?.statusDetails)) {
      return { framework: "allure", tests: parseAllureResults(json) };
    }
    if (json.config && json.suites && json.suites[0]?.tests?.[0]?.results) {
      return { framework: "playwright", tests: parsePlaywrightJson(json) };
    }
    if (json.stats && (json.results || json.suites)) {
      return { framework: "cypress", tests: parseCypressJson(json) };
    }
    if (json.suites) return { framework: "playwright", tests: parsePlaywrightJson(json) };
  } catch (_) { /* not json */ }
  return { framework: "unknown", tests: [] };
}
