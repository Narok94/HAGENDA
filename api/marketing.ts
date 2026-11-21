import { randomUUID } from "node:crypto";
import type { Router, Request, Response } from "express";
import { INITIAL_MARKETING_POSTS } from "../src/data/marketingData.js";
import {
  validatePost,
  parseImport,
  postKey,
  normalize,
  type MarketingPost,
} from "../src/utils/marketing.js";
// The existing access gate authenticates one app owner. Never trust a client user ID.
export const marketingOwner = () => process.env.APP_USER_ID || "hagenda-owner";
export async function migrateMarketing(sql: any) {
  await sql`CREATE TABLE IF NOT EXISTS marketing_brands(owner_id text NOT NULL, name text NOT NULL, PRIMARY KEY(owner_id,name))`;
  await sql`CREATE TABLE IF NOT EXISTS marketing_posts(owner_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL, fingerprint text NOT NULL, revision integer NOT NULL DEFAULT 1, PRIMARY KEY(owner_id,id), UNIQUE(owner_id,fingerprint))`;
  await sql`CREATE TABLE IF NOT EXISTS marketing_imports(owner_id text NOT NULL, source text NOT NULL, PRIMARY KEY(owner_id,source))`;
}
const fromRow = (r: any) => ({
  ...r.data,
  id: r.id,
  version: String(r.revision),
});
export async function seedMarketing(sql: any, owner: string) {
  const source = "pdf-calendars-nov-dec-2026-v1";
  if (
    (
      await sql`SELECT 1 FROM marketing_imports WHERE owner_id=${owner} AND source=${source}`
    ).length
  )
    return;
  const queries = [
    sql`SELECT pg_advisory_xact_lock(hashtext(${owner + "marketing-seed"}))`,
  ];
  for (const name of ["Passione", "Narok Store"])
    queries.push(
      sql`INSERT INTO marketing_brands VALUES(${owner},${name}) ON CONFLICT DO NOTHING`,
    );
  for (const p of INITIAL_MARKETING_POSTS) {
    // Before inserting, compare semantic identity as well as the unique fingerprint.
    queries.push(sql`INSERT INTO marketing_posts(owner_id,id,data,fingerprint)
      SELECT ${owner},${p.id},${JSON.stringify(p)}::jsonb,${postKey(p)}
      WHERE NOT EXISTS(SELECT 1 FROM marketing_imports WHERE owner_id=${owner} AND source=${source})
      AND NOT EXISTS(SELECT 1 FROM marketing_posts WHERE owner_id=${owner}
        AND lower(trim(data->>'brand'))=${normalize(p.brand)} AND data->>'date'=${p.date}
        AND lower(regexp_replace(trim(data->>'title'),'\s+',' ','g'))=${normalize(p.title)})
      ON CONFLICT DO NOTHING`);
  }
  queries.push(
    sql`INSERT INTO marketing_imports VALUES(${owner},${source}) ON CONFLICT DO NOTHING`,
  );
  await sql.transaction(queries);
}
export function installMarketing(router: Router, getDb: () => any) {
  const route =
    (
      handler: (
        req: Request,
        res: Response,
        sql: any,
        owner: string,
      ) => Promise<any>,
    ) =>
    async (req: Request, res: Response) => {
      const sql = getDb();
      if (!sql)
        return res
          .status(503)
          .json({ error: "Banco indisponível. Nenhuma alteração foi salva." });
      try {
        return await handler(req, res, sql, marketingOwner());
      } catch (e: any) {
        if (e.code === "23505")
          return res
            .status(409)
            .json({ error: "Publicação equivalente já cadastrada." });
        console.error("Marketing:", e.message);
        return res.status(503).json({
          error:
            "Não foi possível salvar ou carregar o Marketing. Tente novamente.",
        });
      }
    };
  router.get(
    "/marketing",
    route(async (_req, res, sql, owner) => {
      await seedMarketing(sql, owner);
      const [posts, brands] = await Promise.all([
        sql`SELECT * FROM marketing_posts WHERE owner_id=${owner} ORDER BY data->>'date',data->>'time'`,
        sql`SELECT name FROM marketing_brands WHERE owner_id=${owner} ORDER BY CASE name WHEN 'Passione' THEN 0 WHEN 'Narok Store' THEN 1 ELSE 2 END,name`,
      ]);
      res.json({
        posts: posts.map(fromRow),
        brands: brands.map((r: any) => r.name),
      });
    }),
  );
  router.post(
    "/marketing/brands",
    route(async (req, res, sql, owner) => {
      const name = req.body.name;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 100)
        return res.status(400).json({ error: "Nome de marca inválido" });
      await sql`INSERT INTO marketing_brands VALUES(${owner},${name.trim()}) ON CONFLICT DO NOTHING`;
      res.json({ name: name.trim() });
    }),
  );
  router.post(
    "/marketing/import",
    route(async (req, res, sql, owner) => {
      let posts: MarketingPost[];
      try {
        posts = parseImport(JSON.stringify(req.body));
      } catch (e) {
        return res.status(400).json({ error: (e as Error).message });
      }
      const queries = [];
      for (const p of posts) {
        const id = randomUUID();
        queries.push(
          sql`INSERT INTO marketing_brands VALUES(${owner},${p.brand}) ON CONFLICT DO NOTHING`,
        );
        queries.push(
          sql`INSERT INTO marketing_posts(owner_id,id,data,fingerprint) VALUES(${owner},${id},${JSON.stringify({ ...p, id })}::jsonb,${postKey(p)}) ON CONFLICT DO NOTHING RETURNING id`,
        );
      }
      const results = await sql.transaction(queries);
      const inserted = results
        .filter((_: any, i: number) => i % 2 === 1)
        .reduce((n: number, r: any[]) => n + r.length, 0);
      res.json({ inserted, duplicates: posts.length - inserted });
    }),
  );
  router.post(
    "/marketing/posts",
    route(async (req, res, sql, owner) => {
      let p: MarketingPost;
      try {
        p = validatePost(req.body);
      } catch (e) {
        return res.status(400).json({ error: (e as Error).message });
      }
      const id = randomUUID();
      const results = await sql.transaction([
        sql`INSERT INTO marketing_brands VALUES(${owner},${p.brand}) ON CONFLICT DO NOTHING`,
        sql`INSERT INTO marketing_posts(owner_id,id,data,fingerprint) VALUES(${owner},${id},${JSON.stringify({ ...p, id })}::jsonb,${postKey(p)}) RETURNING *`,
      ]);
      res.status(201).json(fromRow(results[1][0]));
    }),
  );
  router.put(
    "/marketing/posts/:id",
    route(async (req, res, sql, owner) => {
      let p: MarketingPost;
      try {
        p = validatePost(req.body);
      } catch (e) {
        return res.status(400).json({ error: (e as Error).message });
      }
      const revision = Number(req.headers["if-match"]);
      if (!Number.isInteger(revision) || revision < 1)
        return res.status(400).json({ error: "Versão obrigatória" });
      const rows =
        await sql`UPDATE marketing_posts SET data=${JSON.stringify({ ...p, id: req.params.id })}::jsonb,fingerprint=${postKey(p)},revision=revision+1 WHERE owner_id=${owner} AND id=${req.params.id} AND revision=${revision} RETURNING *`;
      if (!rows.length)
        return res.status(409).json({
          error:
            "Publicação alterada em outro dispositivo. Recarregue antes de editar.",
        });
      res.json(fromRow(rows[0]));
    }),
  );
  router.delete(
    "/marketing/posts/:id",
    route(async (req, res, sql, owner) => {
      const rows =
        await sql`DELETE FROM marketing_posts WHERE owner_id=${owner} AND id=${req.params.id} AND revision=${Number(req.headers["if-match"]) || 0} RETURNING id`;
      if (!rows.length)
        return res
          .status(409)
          .json({ error: "Publicação alterada. Recarregue antes de excluir." });
      res.json({ success: true });
    }),
  );
}
