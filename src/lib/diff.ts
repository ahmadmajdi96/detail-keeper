/** Minimal line-level diff (LCS based) used by the document history viewer. */
export type DiffLine = {
  type: "same" | "add" | "del";
  text: string;
  leftNo: number | null;
  rightNo: number | null;
};

export function diffLines(before: string, after: string): DiffLine[] {
  const a = (before ?? "").split("\n");
  const b = (after ?? "").split("\n");

  // LCS table — inputs are documents, so sizes stay manageable.
  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0, j = 0, li = 1, ri = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i], leftNo: li++, rightNo: ri++ });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: a[i], leftNo: li++, rightNo: null });
      i++;
    } else {
      out.push({ type: "add", text: b[j], leftNo: null, rightNo: ri++ });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++], leftNo: li++, rightNo: null });
  while (j < m) out.push({ type: "add", text: b[j++], leftNo: null, rightNo: ri++ });
  return out;
}

export function diffStats(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.type === "add").length,
    removed: lines.filter((l) => l.type === "del").length,
    unchanged: lines.filter((l) => l.type === "same").length,
  };
}

/** Collapses long runs of unchanged lines, keeping `context` lines around edits. */
export function collapseContext(lines: DiffLine[], context = 3): (DiffLine | { type: "gap"; count: number })[] {
  const keep = new Set<number>();
  lines.forEach((l, idx) => {
    if (l.type === "same") return;
    for (let k = idx - context; k <= idx + context; k++) if (k >= 0 && k < lines.length) keep.add(k);
  });
  const out: (DiffLine | { type: "gap"; count: number })[] = [];
  let gap = 0;
  lines.forEach((l, idx) => {
    if (keep.has(idx)) {
      if (gap) { out.push({ type: "gap", count: gap }); gap = 0; }
      out.push(l);
    } else gap++;
  });
  if (gap) out.push({ type: "gap", count: gap });
  return out;
}
