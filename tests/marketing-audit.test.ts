import { test } from "node:test";
import assert from "node:assert/strict";
import { auditMarketing } from "../scripts/marketing-audit.js";
import { INITIAL_MARKETING_POSTS } from "../src/data/marketingData.js";

test("production audit requires all 24 source entries, reports duplicates and never changes records", () => {
  const posts = structuredClone(INITIAL_MARKETING_POSTS);
  const original = JSON.stringify(posts);
  const report = auditMarketing(posts);
  assert.equal(report.ok, true);
  assert.deepEqual(report.brands, { Passione: 14, "Narok Store": 10 });
  assert.equal(auditMarketing(posts.slice(1)).ok, false);
  assert.deepEqual(
    auditMarketing([...posts, { ...posts[0], id: "duplicate" }]).duplicates,
    [["pdf-2026-1", "duplicate"]],
  );
  posts[0].time = "20:00";
  assert.deepEqual(auditMarketing(posts).mismatched, ["pdf-2026-1"]);
  posts[0].time = INITIAL_MARKETING_POSTS[0].time;
  assert.equal(JSON.stringify(posts), original);
});
