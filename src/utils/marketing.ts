export const MARKETING_STATUSES = [
  "Ideia",
  "Planejado",
  "Em produção",
  "Pronto",
  "Publicado",
] as const;
export const METRICS = [
  "alcance",
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "novosSeguidores",
] as const;
export type MarketingPost = {
  id: string;
  version?: string;
  brand: string;
  network: string;
  format: string;
  title: string;
  instructions: string;
  caption: string;
  date: string;
  time: string;
  status: (typeof MARKETING_STATUSES)[number];
  attachments: { name: string; data: string }[];
  metrics: Partial<Record<(typeof METRICS)[number], number>>;
  source?: string;
};
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const normalize = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export const postKey = (p: MarketingPost) =>
  [p.brand, p.date, p.title].map(normalize).join("|");
export function validatePost(value: unknown): MarketingPost {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Publicação inválida");
  const p = value as MarketingPost;
  for (const field of [
    "brand",
    "network",
    "format",
    "title",
    "instructions",
    "caption",
    "date",
    "time",
  ] as const) {
    if (
      typeof p[field] !== "string" ||
      p[field].length >
        (["instructions", "caption"].includes(field) ? 20000 : 300)
    )
      throw new Error(`Campo inválido: ${field}`);
  }
  if (!p.brand.trim() || !p.title.trim())
    throw new Error("Marca e título são obrigatórios");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
    isNaN(Date.parse(p.date + "T12:00:00Z")) ||
    new Date(p.date + "T12:00:00Z").toISOString().slice(0, 10) !== p.date
  )
    throw new Error("Data inválida (AAAA-MM-DD)");
  if (p.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))
    throw new Error("Horário inválido (HH:MM ou vazio)");
  if (!MARKETING_STATUSES.includes(p.status))
    throw new Error("Status inválido");
  if (!Array.isArray(p.attachments) || p.attachments.length > 5)
    throw new Error("Use até 5 anexos");
  let size = 0;
  for (const a of p.attachments) {
    if (
      !a ||
      typeof a.name !== "string" ||
      a.name.length > 300 ||
      typeof a.data !== "string" ||
      !/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(
        a.data,
      )
    )
      throw new Error("Anexo inválido: use imagem ou PDF");
    size += a.data.length;
  }
  if (size > 2800000) throw new Error("Anexos excedem 2 MB por publicação");
  if (!p.metrics || typeof p.metrics !== "object" || Array.isArray(p.metrics))
    throw new Error("Métricas inválidas");
  for (const [key, v] of Object.entries(p.metrics))
    if (!METRICS.includes(key as any) || !Number.isSafeInteger(v) || v < 0)
      throw new Error("Métricas devem ser inteiros não negativos");
  return {
    brand: p.brand.trim(),
    network: p.network.trim(),
    format: p.format.trim(),
    title: p.title.trim(),
    instructions: p.instructions,
    caption: p.caption,
    date: p.date,
    time: p.time,
    status: p.status,
    attachments: p.attachments,
    metrics: p.metrics,
    id: p.id,
    ...(typeof p.source === "string"
      ? { source: p.source.slice(0, 2000) }
      : {}),
  };
}
export function parseImport(raw: string): MarketingPost[] {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object")
    throw new Error("Envie uma lista JSON de publicações");
  const rows = Array.isArray(data) ? data : data.publications;
  if (!Array.isArray(rows) || !rows.length || rows.length > 100)
    throw new Error("Envie uma lista de 1 a 100 publicações");
  return rows.map((r, i) => {
    try {
      return validatePost({
        ...r,
        instructions: r.instructions ?? "",
        caption: r.caption ?? "",
        time: r.time ?? "",
        network: r.network ?? "",
        format: r.format ?? "",
        attachments: r.attachments ?? [],
        metrics: r.metrics ?? {},
      });
    } catch (e) {
      throw new Error(`Linha ${i + 1}: ${(e as Error).message}`);
    }
  });
}
