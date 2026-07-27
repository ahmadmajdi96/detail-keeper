/**
 * Client-side validation for generated Playwright specs.
 *
 * Runs three passes without executing anything:
 *  1. format  — whitespace/indent normalisation (produces a fixed source)
 *  2. lint    — Playwright-specific hygiene rules
 *  3. syntax  — bracket/quote/template balance + structural sanity checks
 */

export type Severity = "error" | "warning";

export interface ValidationIssue {
  pass: "format" | "lint" | "syntax";
  severity: Severity;
  line: number;
  rule: string;
  message: string;
}

export interface ValidationResult {
  filename: string;
  ok: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
  /** Formatted source; identical to the input when nothing needed fixing. */
  formatted: string;
  formatChanged: boolean;
}

/** Normalises indentation, trailing whitespace, blank runs and final newline. */
export function formatSource(src: string): string {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let blanks = 0;
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ").replace(/[ \t]+$/g, "");
    if (line.trim() === "") {
      blanks += 1;
      if (blanks > 1) continue;
    } else {
      blanks = 0;
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return `${out.join("\n")}\n`;
}

/** Strips strings, template literals and comments so scanners can't be fooled. */
function stripLiterals(src: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "line" | "block" | "'" | '"' | "`" = "code";
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (mode === "code") {
      if (c === "/" && next === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && next === "*") { mode = "block"; i += 2; continue; }
      if (c === "'" || c === '"' || c === "`") { mode = c as any; out += " "; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += "\n"; }
      i += 1; continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") { mode = "code"; i += 2; continue; }
      if (c === "\n") out += "\n";
      i += 1; continue;
    }
    // inside a string / template literal
    if (c === "\\") { i += 2; continue; }
    if (c === mode) { mode = "code"; out += " "; i += 1; continue; }
    if (c === "\n") out += "\n";
    i += 1;
  }
  return out;
}

function syntaxIssues(src: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stripped = stripLiterals(src);

  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { ch: string; line: number }[] = [];
  let line = 1;
  for (const ch of stripped) {
    if (ch === "\n") { line += 1; continue; }
    if (ch === "(" || ch === "[" || ch === "{") stack.push({ ch, line });
    else if (ch in pairs) {
      const top = stack.pop();
      if (!top || top.ch !== pairs[ch]) {
        issues.push({
          pass: "syntax", severity: "error", line, rule: "unbalanced-bracket",
          message: `Unexpected closing “${ch}”`,
        });
      }
    }
  }
  stack.forEach((s) =>
    issues.push({
      pass: "syntax", severity: "error", line: s.line, rule: "unbalanced-bracket",
      message: `Unclosed “${s.ch}” opened here`,
    }),
  );

  // Unterminated string / template literal detection.
  const quoteCounts = (src.match(/(^|[^\\])`/g) ?? []).length;
  if (quoteCounts % 2 !== 0) {
    issues.push({
      pass: "syntax", severity: "error", line: 1, rule: "unterminated-template",
      message: "Unterminated template literal (odd number of backticks)",
    });
  }

  src.split("\n").forEach((l, i) => {
    const bare = stripLiterals(l);
    const singles = (bare.match(/'/g) ?? []).length;
    const doubles = (bare.match(/"/g) ?? []).length;
    if (singles % 2 !== 0 || doubles % 2 !== 0) {
      issues.push({
        pass: "syntax", severity: "error", line: i + 1, rule: "unterminated-string",
        message: "Unterminated string literal on this line",
      });
    }
  });

  return issues;
}

function lintIssues(src: string, filename: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isSpec = /\.(spec|test)\.(ts|tsx|js|mjs)$/i.test(filename);
  const stripped = stripLiterals(src);
  const lines = src.split("\n");

  lines.forEach((l, i) => {
    const n = i + 1;
    if (/\btest\.only\s*\(|\bdescribe\.only\s*\(|\bit\.only\s*\(/.test(l)) {
      issues.push({ pass: "lint", severity: "error", line: n, rule: "no-focused-test", message: "Focused test (.only) would skip the rest of the suite" });
    }
    if (/page\.waitForTimeout\s*\(/.test(l)) {
      issues.push({ pass: "lint", severity: "warning", line: n, rule: "no-hard-wait", message: "Hard wait — prefer web-first assertions or waitFor()" });
    }
    if (/^\s*(page|expect|request)\.[a-zA-Z]/.test(l) && !/await|return|=>|\.then\(/.test(l)) {
      issues.push({ pass: "lint", severity: "warning", line: n, rule: "await-async-call", message: "Missing await on an async Playwright call" });
    }
    if (/\bconsole\.log\s*\(/.test(l)) {
      issues.push({ pass: "lint", severity: "warning", line: n, rule: "no-console", message: "Leftover console.log" });
    }
    if (/\bdebugger\b/.test(stripLiterals(l))) {
      issues.push({ pass: "lint", severity: "error", line: n, rule: "no-debugger", message: "debugger statement" });
    }
    if (l.length > 160) {
      issues.push({ pass: "lint", severity: "warning", line: n, rule: "max-len", message: `Line is ${l.length} chars (max 160)` });
    }
  });

  if (isSpec) {
    if (!/@playwright\/test|require\(['"]@playwright\/test['"]\)/.test(src)) {
      issues.push({ pass: "lint", severity: "error", line: 1, rule: "missing-import", message: "Spec does not import from @playwright/test" });
    }
    if (!/\b(test|it)\s*(\.\w+)?\s*\(/.test(stripped)) {
      issues.push({ pass: "lint", severity: "error", line: 1, rule: "no-tests", message: "No test() block found in this spec" });
    }
    if (!/\bexpect\s*\(/.test(stripped)) {
      issues.push({ pass: "lint", severity: "warning", line: 1, rule: "no-assertion", message: "Spec contains no expect() assertion" });
    }
  }

  return issues;
}

function formatIssues(src: string, formatted: string): ValidationIssue[] {
  if (src === formatted) return [];
  const issues: ValidationIssue[] = [];
  src.split("\n").forEach((l, i) => {
    if (/[ \t]+$/.test(l)) issues.push({ pass: "format", severity: "warning", line: i + 1, rule: "trailing-whitespace", message: "Trailing whitespace" });
    if (/\t/.test(l)) issues.push({ pass: "format", severity: "warning", line: i + 1, rule: "no-tabs", message: "Tab indentation — use two spaces" });
  });
  if (!issues.length) {
    issues.push({ pass: "format", severity: "warning", line: 1, rule: "formatting", message: "File is not formatted (blank lines / final newline)" });
  }
  return issues;
}

/** Runs all three passes over one spec file. */
export function validateSpec(filename: string, content: string): ValidationResult {
  const formatted = formatSource(content ?? "");
  const issues = [
    ...syntaxIssues(content ?? ""),
    ...lintIssues(content ?? "", filename),
    ...formatIssues(content ?? "", formatted),
  ].sort((a, b) => a.line - b.line);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  return {
    filename,
    ok: errors === 0,
    errors,
    warnings,
    issues,
    formatted,
    formatChanged: formatted !== content,
  };
}

export function summarize(results: ValidationResult[]) {
  return {
    files: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    errors: results.reduce((n, r) => n + r.errors, 0),
    warnings: results.reduce((n, r) => n + r.warnings, 0),
  };
}
