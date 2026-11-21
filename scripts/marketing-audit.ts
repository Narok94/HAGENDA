import { INITIAL_MARKETING_POSTS } from "../src/data/marketingData.js";
import { postKey, type MarketingPost } from "../src/utils/marketing.js";

// A read-only audit. The existing GET /marketing performs its one-time import.
// Never repair, delete, or overwrite a publication from this verifier.
export function auditMarketing(posts: MarketingPost[]) {
  const groups = new Map<string, MarketingPost[]>();
  for (const post of posts) {
    const key = postKey(post);
    groups.set(key, [...(groups.get(key) || []), post]);
  }
  const missing: string[] = [],
    mismatched: string[] = [];
  const duplicates = [...groups.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => rows.map((p) => p.id));
  let matched = 0;
  const brands: Record<string, number> = {};
  for (const expected of INITIAL_MARKETING_POSTS) {
    const rows = groups.get(postKey(expected)) || [];
    if (!rows.length) {
      missing.push(expected.id);
      continue;
    }
    matched++;
    brands[expected.brand] = (brands[expected.brand] || 0) + 1;
    // Existing equivalents can contain user changes: report differences, never fix them.
    if (
      rows.length === 1 &&
      (["time", "format", "network", "instructions"] as const).some(
        (key) => rows[0][key] !== expected[key],
      )
    )
      mismatched.push(expected.id);
  }
  return {
    expected: INITIAL_MARKETING_POSTS.length,
    matched,
    brands,
    missing,
    mismatched,
    duplicates,
    ok:
      matched === INITIAL_MARKETING_POSTS.length &&
      !missing.length &&
      !mismatched.length &&
      !duplicates.length,
  };
}
