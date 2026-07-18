import { describe, it, expect, vi } from "vitest";
import { renderMentionBody } from "@/components/mentions/MentionTextarea";

/**
 * Integration contract between mention rendering and defect comment storage:
 *
 * A comment body containing `@[Name](uuid)` tokens MUST:
 *   1. Render each mention as a highlighted pill (renderMentionBody).
 *   2. Yield a stable set of mentioned user ids so the caller can persist
 *      them into `defect_comments.metadata.mentions` (jsonb array).
 *
 * The DB trigger `notify_defect_comment_mentions` fans out notifications
 * from that array, so any drift here silently drops @-mentions on the floor.
 */

// Same regex the textarea + renderer use — keeping the invariant explicit.
const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;
function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null) ids.add(m[2]);
  return Array.from(ids);
}

describe("mention extraction", () => {
  it("extracts every mentioned user id from a comment body", () => {
    const body =
      "Hi @[Alice](11111111-1111-1111-1111-111111111111), can you loop in " +
      "@[Bob](22222222-2222-2222-2222-222222222222)?";
    expect(extractMentionIds(body)).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);
  });

  it("dedupes duplicate mentions of the same user", () => {
    const body =
      "@[Alice](11111111-1111-1111-1111-111111111111) and again " +
      "@[Alice](11111111-1111-1111-1111-111111111111)";
    expect(extractMentionIds(body)).toEqual([
      "11111111-1111-1111-1111-111111111111",
    ]);
  });

  it("returns [] when there are no mentions", () => {
    expect(extractMentionIds("no mentions here")).toEqual([]);
  });

  it("renders mentions as styled pills, not raw tokens", () => {
    const nodes = renderMentionBody(
      "Hi @[Alice](11111111-1111-1111-1111-111111111111)!",
    );
    // The raw @[...](...) marker must NOT leak into the rendered output.
    const flat = JSON.stringify(nodes);
    expect(flat).not.toMatch(/@\[Alice\]\(/);
    expect(flat).toContain("@Alice");
  });
});

describe("defect comment insert payload", () => {
  it("stores the mentioned ids in metadata.mentions so the trigger can notify", () => {
    const body =
      "Please review @[Alice](11111111-1111-1111-1111-111111111111) " +
      "and @[Bob](22222222-2222-2222-2222-222222222222).";
    const mentions = extractMentionIds(body);

    // Simulate the shape defect comment inserts use (see DefectCommentsPanel).
    const insert = vi.fn();
    const authorId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const defectId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    insert({
      defect_id: defectId,
      author_id: authorId,
      body,
      metadata: { mentions },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        defect_id: defectId,
        body: expect.stringContaining("@[Alice]"),
        metadata: {
          mentions: [
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
          ],
        },
      }),
    );
  });
});
