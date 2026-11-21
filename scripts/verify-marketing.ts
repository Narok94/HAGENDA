import { auditMarketing } from "./marketing-audit.js";
import type { MarketingPost } from "../src/utils/marketing.js";
import "dotenv/config";

async function main() {
  const rawUrl = process.argv[2] || process.env.HAGENDA_URL;
  if (!rawUrl || !process.env.APP_ACCESS_TOKEN)
    throw new Error(
      "Informe a URL do aplicativo e APP_ACCESS_TOKEN no ambiente. Não passe o código na linha de comando.",
    );
  const base = new URL(rawUrl);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new Error("Use HTTPS para a verificação autenticada.");
  if (base.username || base.password)
    throw new Error("Não inclua credenciais na URL.");
  async function get(path: string) {
    const response = await fetch(new URL(path, base), {
      redirect: "error",
      signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${process.env.APP_ACCESS_TOKEN}` },
    });
    if (!response.ok)
      throw new Error(
        `${path}: HTTP ${response.status}. Verifique deploy e autenticação.`,
      );
    return response.json();
  }
  const database = await get("/api/db-status");
  if (!database.connected || database.mode !== "neon")
    throw new Error("A API não confirmou conexão com o Neon.");
  const first = await get("/api/marketing"),
    second = await get("/api/marketing");
  if (!Array.isArray(first.posts) || !Array.isArray(second.posts))
    throw new Error("Resposta inválida de Marketing");
  const snapshot = (posts: MarketingPost[]) =>
    JSON.stringify(
      posts
        .map((p) => [p.id, p.version])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  const stable = snapshot(first.posts) === snapshot(second.posts);
  const report = {
    database: "neon",
    stableAcrossRepeatedRead: stable,
    ...auditMarketing(second.posts),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!stable || !report.ok) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
