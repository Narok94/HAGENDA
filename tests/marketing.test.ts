import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import {
  migrateMarketing,
  installMarketing,
  seedMarketing,
} from "../api/_marketing.js";
import { INITIAL_MARKETING_POSTS } from "../src/data/marketingData.js";
import { parseImport, postKey } from "../src/utils/marketing.js";
let db: PGlite, sql: any, server: Server, base: string;
const post = {
  ...INITIAL_MARKETING_POSTS[0],
  id: "",
  title: "Campanha de teste",
  attachments: [{ name: "imagem.png", data: "data:image/png;base64,aGVsbG8=" }],
  metrics: { alcance: 100, curtidas: 12 },
};
before(async () => {
  db = new PGlite();
  sql = (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, "");
    return {
      text,
      values,
      then(resolve: any, reject: any) {
        return db
          .query(text, values)
          .then((r) => r.rows)
          .then(resolve, reject);
      },
    };
  };
  sql.transaction = (queries: any[]) =>
    db.transaction(async (tx) => {
      const results = [];
      for (const q of queries) {
        if (q.text.includes("pg_advisory_xact_lock")) {
          results.push([]);
          continue;
        }
        results.push((await tx.query(q.text, q.values)).rows);
      }
      return results;
    });
  await migrateMarketing(sql);
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  installMarketing(app, () => sql);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  base = `http://127.0.0.1:${addr.port}`;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.close();
});
const req = (path = "", method = "GET", body?: unknown, version?: string) =>
  fetch(base + "/marketing" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(version ? { "If-Match": version } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
test("initial PDF import checks existing equivalents, preserves edits/deletions, and isolates owners", async () => {
  const existing = {
    ...INITIAL_MARKETING_POSTS[0],
    id: "existing",
    time: "20:00",
    instructions: "Anotação existente",
  };
  await sql`INSERT INTO marketing_posts(owner_id,id,data,fingerprint) VALUES('hagenda-owner',${existing.id},${JSON.stringify(existing)}::jsonb,${postKey(existing)})`;
  const response = await req();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.posts.length, 24);
  assert.equal(
    data.posts.find((p: any) => p.id === "existing").instructions,
    "Anotação existente",
  );
  assert.equal(
    data.posts
      .filter((p: any) => p.brand === "Narok Store")
      .every((p: any) => p.time === ""),
    true,
  );
  assert.equal(
    data.posts
      .filter((p: any) => p.brand === "Passione")
      .every((p: any) => p.network === ""),
    true,
  );
  const seeded = data.posts.find((p: any) => p.id === "pdf-2026-2");
  assert.equal(
    (await req("/posts/" + seeded.id, "DELETE", undefined, seeded.version))
      .status,
    200,
  );
  assert.equal((await (await req()).json()).posts.length, 23);
  await seedMarketing(sql, "other-owner");
  assert.equal((await (await req()).json()).posts.length, 23);
  const other = (
    await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM marketing_posts WHERE owner_id='other-owner'",
    )
  ).rows[0];
  assert.equal(other.n, 24);
});
test("CRUD, reschedule, metrics, attachments, duplicate prevention and conflict protection", async () => {
  const response = await req("/posts", "POST", post);
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.metrics.alcance, 100);
  assert.deepEqual(saved.attachments, post.attachments);
  assert.equal((await req("/posts", "POST", post)).status, 409);
  const changed = await req(
    "/posts/" + saved.id,
    "PUT",
    {
      ...saved,
      date: "2026-12-09",
      time: "09:45",
      status: "Publicado",
      metrics: { ...saved.metrics, salvamentos: 3 },
    },
    saved.version,
  );
  assert.equal(changed.status, 200);
  const updated = await changed.json();
  assert.equal(updated.date, "2026-12-09");
  assert.equal(updated.metrics.salvamentos, 3);
  assert.equal(
    (await req("/posts/" + saved.id, "PUT", saved, saved.version)).status,
    409,
  );
  assert.equal(
    (await req("/posts/" + saved.id, "DELETE", undefined, saved.version))
      .status,
    409,
  );
  assert.equal(
    (await req("/posts/" + saved.id, "DELETE", undefined, updated.version))
      .status,
    200,
  );
  const copy = await req("/posts", "POST", {
    ...post,
    title: post.title + " (cópia)",
  });
  assert.equal(copy.status, 201);
});
test("batch import is validated, skips duplicates and persists added brands", async () => {
  const batch = [
    { ...post, title: "Lote", brand: "Nova marca" },
    { ...post, title: "Lote", brand: "Nova marca" },
  ];
  const first = await req("/import", "POST", batch);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { inserted: 1, duplicates: 1 });
  assert.deepEqual(await (await req("/import", "POST", batch)).json(), {
    inserted: 0,
    duplicates: 2,
  });
  assert.equal(
    (
      await req("/import", "POST", [
        { ...post, title: "Não pode entrar" },
        { ...post, date: "2026-02-30" },
      ])
    ).status,
    400,
  );
  const data = await (await req()).json();
  assert.ok(data.brands.includes("Nova marca"));
  assert.ok(!data.posts.some((p: any) => p.title === "Não pode entrar"));
  assert.equal(
    (await req("/posts", "POST", { ...post, metrics: { alcance: -1 } })).status,
    400,
  );
  assert.equal(
    (
      await req("/posts", "POST", {
        ...post,
        attachments: [{ name: "html", data: "data:text/html;base64,aGVsbG8=" }],
      })
    ).status,
    400,
  );
  assert.throws(() => parseImport('[{"date":"2026-11-23"}]'));
});
test("owner scope cannot be supplied by request body or headers", async () => {
  const foreign = (
    await db.query<{ id: string; revision: number }>(
      "SELECT id,revision FROM marketing_posts WHERE owner_id='other-owner' AND id='pdf-2026-1'",
    )
  ).rows[0];
  assert.equal(
    (
      await req(
        "/posts/" + foreign.id,
        "PUT",
        { ...post, owner_id: "other-owner" },
        String(foreign.revision),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        "/posts/" + foreign.id,
        "DELETE",
        undefined,
        String(foreign.revision),
      )
    ).status,
    409,
  );
});
