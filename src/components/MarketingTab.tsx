import "./MarketingTab.css";
import React, { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Camera,
  Play,
  BarChart3,
  X,
  Copy,
  Trash2,
  Menu,
  Bell,
  Upload,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  dateKey,
  MARKETING_STATUSES,
  METRICS,
  parseImport,
  postKey,
  type MarketingPost,
} from "../utils/marketing";
import { marketingRequest } from "../hooks/useMarketing";
const metricNames = [
  "Alcance",
  "Curtidas",
  "Comentários",
  "Compartilhamentos",
  "Salvamentos",
  "Novos seguidores",
];
type Store = ReturnType<typeof import("../hooks/useMarketing").useMarketing>;
const humanDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
function PostCard({
  post: p,
  onOpen,
}: {
  post: MarketingPost;
  onOpen: () => void;
  key?: string;
}) {
  const Icon = /reel|vídeo/i.test(p.format)
    ? Play
    : /story/i.test(p.format)
      ? BarChart3
      : Camera;
  return (
    <button className="marketing-post" onClick={onOpen}>
      <span className="marketing-time">
        <strong className={!p.time ? "marketing-untimed" : undefined}>
          {p.time || "A definir"}
        </strong>
        <span>
          <Icon size={23} />
        </span>
      </span>
      <span className="marketing-post-copy">
        <span className="marketing-post-meta">
          <span
            className={`marketing-brand ${p.brand === "Passione" ? "passione" : ""}`}
          >
            {p.brand}
          </span>
          <span className="marketing-network">
            {p.network === "Instagram" && <Instagram size={17} />} {p.network}{" "}
            {p.format}
          </span>
          <span className="marketing-status" data-status={p.status}>
            {p.status}
          </span>
        </span>
        <strong>{p.title}</strong>
        {p.instructions && (
          <span className="marketing-instructions">{p.instructions}</span>
        )}
      </span>
    </button>
  );
}
export function MarketingToday({
  store,
  onOpen,
  now = new Date(),
}: {
  store: Store;
  onOpen: () => void;
  now?: Date;
}) {
  const posts = store.posts.filter((p) => p.date === dateKey(now));
  return (
    <section className="marketing-home">
      <div className="home-section-heading">
        <h2>O que postar hoje?</h2>
        <button onClick={onOpen}>
          Marketing <ChevronRight size={14} />
        </button>
      </div>
      {store.error ? (
        <p role="alert">{store.error}</p>
      ) : store.loading ? (
        <p>Carregando publicações…</p>
      ) : posts.length ? (
        posts.map((p) => (
          <button key={p.id} className="marketing-home-post" onClick={onOpen}>
            <strong className={!p.time ? "marketing-untimed" : undefined}>
              {p.time || "A definir"}
            </strong>
            <span>
              <strong>{p.title}</strong>
              <small>
                {p.brand} · {p.status}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))
      ) : (
        <p>Nenhuma publicação planejada para hoje.</p>
      )}
    </section>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,a[href],[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className="marketing-overlay">
      <div
        ref={ref}
        className="marketing-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
const blank = (brand: string, date: string): MarketingPost => ({
  id: "",
  brand,
  network: "",
  format: "",
  title: "",
  instructions: "",
  caption: "",
  date,
  time: "",
  status: "Ideia",
  attachments: [],
  metrics: {},
});
export default function MarketingTab({
  store,
  now,
  onMenu,
  onSettings,
}: {
  store: Store;
  now: Date;
  onMenu: () => void;
  onSettings: () => void;
}) {
  const today = dateKey(now);
  const [brand, setBrand] = useState(""),
    [status, setStatus] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [mode, setMode] = useState<"week" | "month" | "all">("week"),
    [cursor, setCursor] = useState(today),
    [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<MarketingPost | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [raw, setRaw] = useState(""),
    [preview, setPreview] = useState<MarketingPost[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [brandOpen, setBrandOpen] = useState(false),
    [brandName, setBrandName] = useState("");
  const calendarInitialized = useRef(false);
  useEffect(() => {
    if (store.loading || store.error || calendarInitialized.current) return;
    calendarInitialized.current = true;
    const monday = new Date(today + "T12:00:00");
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const dates = store.posts.map((p) => p.date).sort();
    if (
      dates.some((date) => date >= dateKey(monday) && date <= dateKey(sunday))
    )
      return;
    const next = dates.find((date) => date >= today) || dates.at(-1);
    if (next) {
      setCursor(next);
      setSelected(next);
    }
  }, [store.loading, store.error, store.posts, today]);
  const showSaved = () => {
    setBrand("");
    setStatus("");
    setStart("");
    setEnd("");
    setMode("all");
    setImportOpen(false);
    requestAnimationFrame(() => document.querySelector(".marketing-editorial")?.scrollIntoView({ block: "start" }));
  };
  const filtered = store.posts
    .filter(
      (p) =>
        (!brand || p.brand === brand) &&
        (!status || p.status === status) &&
        (!start || p.date >= start) &&
        (!end || p.date <= end),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || "99").localeCompare(b.time || "99"),
    );
  const dayPosts = filtered.filter((p) => p.date === today);
  const anchor = new Date(cursor + "T12:00:00");
  const first = new Date(anchor);
  if (mode === "month") first.setDate(1);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: mode === "week" ? 7 : 42 }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    return dateKey(d);
  });
  const calendarPosts = filtered.filter((p) =>
    mode === "all"
      ? true
      : mode === "week"
        ? p.date >= days[0] && p.date <= days[6]
        : p.date === selected,
  );
  const move = (amount: number) => {
    const d = new Date(anchor);
    if (mode === "week") d.setDate(d.getDate() + amount * 7);
    else {
      d.setDate(1);
      d.setMonth(d.getMonth() + amount);
    }
    setCursor(dateKey(d));
    setSelected(dateKey(d));
  };
  const edit = (p: MarketingPost) => {
    setError("");
    setDraft(structuredClone(p));
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await store.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    run(async () => {
      await marketingRequest(
        draft.id ? "/posts/" + draft.id : "/posts",
        draft.id ? "PUT" : "POST",
        draft,
        draft.version,
      );
      setDraft(null);
      showSaved();
      setNotice("Publicação salva.");
    });
  };
  const duplicate = () => {
    if (draft) {
      setDraft({
        ...draft,
        id: "",
        version: undefined,
        title: draft.title + " (cópia)",
        status: "Ideia",
      });
      setNotice("Cópia pronta para revisar e salvar.");
    }
  };
  const uniquePreview = () => {
    const known = new Set(store.posts.map(postKey));
    return (preview || []).filter((p) => {
      const k = postKey(p);
      if (known.has(k)) return false;
      known.add(k);
      return true;
    });
  };
  return (
    <div className="marketing-page">
      <header className="marketing-top">
        <button aria-label="Abrir menu" onClick={onMenu}>
          <Menu />
        </button>
        <strong>HAGENDA</strong>
        <button
          aria-label="Abrir configurações e notificações"
          onClick={onSettings}
        >
          <Bell />
        </button>
      </header>
      <div className="marketing-heading">
        <span>
          <Megaphone size={29} />
        </span>
        <div>
          <h1>Marketing</h1>
          <p>Seu planejamento de conteúdo, em dia.</p>
        </div>
      </div>
      <div className="marketing-brands" aria-label="Filtrar por marca">
        {["", ...store.brands].map((b) => (
          <button
            key={b}
            aria-pressed={brand === b}
            onClick={() => setBrand(b)}
          >
            {b || "Todas"}
          </button>
        ))}
        <button aria-label="Adicionar marca" onClick={() => setBrandOpen(true)}>
          <Plus size={18} />
        </button>
      </div>
      {!store.loading && !store.error && (
        <div className="marketing-saved-summary">
          <span>{store.posts.length} publicações salvas</span>
          <button onClick={showSaved}>Ver todas</button>
        </div>
      )}
      {store.error && (
        <div className="marketing-alert" role="alert">
          {store.error}
          <button onClick={store.reload}>Tentar novamente</button>
        </div>
      )}
      {notice && (
        <p className="marketing-notice" role="status">
          {notice}
        </p>
      )}
      {!draft && !importOpen && !brandOpen && error && (
        <p role="alert" className="marketing-alert">
          {error}
        </p>
      )}
      <section className="marketing-panel">
        <div className="marketing-section-title">
          <div>
            <h2>O que postar hoje?</h2>
            <p>
              <CalendarDays size={17} />
              {humanDate(today)}
            </p>
          </div>
          <span>{dayPosts.length} conteúdos</span>
        </div>
        <div className="marketing-posts">
          {store.loading ? (
            <p>Carregando publicações…</p>
          ) : dayPosts.length ? (
            dayPosts.map((p) => (
              <PostCard key={p.id} post={p} onOpen={() => edit(p)} />
            ))
          ) : (
            <p className="marketing-empty">
              Nenhuma publicação para hoje com estes filtros.
            </p>
          )}
        </div>
        <div className="marketing-actions">
          <button
            className="marketing-primary"
            disabled={store.loading || !!store.error}
            onClick={() =>
              edit(blank(brand || store.brands[0] || "Passione", today))
            }
          >
            <Plus size={21} />
            Nova publicação
          </button>
          <button
            onClick={() => {
              setImportOpen(true);
              setError("");
              setPreview(null);
            }}
          >
            <Upload size={20} />
            Importar do ChatGPT
          </button>
        </div>
      </section>
      <section className="marketing-panel marketing-editorial">
        <div className="marketing-section-title">
          <h2>
            <CalendarDays size={21} />
            Calendário editorial
          </h2>
          <div className="marketing-toggle">
            {(["week", "month", "all"] as const).map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m === "week" ? "Semana" : m === "month" ? "Mês" : "Todas"}
              </button>
            ))}
          </div>
        </div>
        <div className="marketing-filters">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {MARKETING_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            De
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (e.target.value) setMode("all");
              }}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              min={start}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                if (e.target.value) setMode("all");
              }}
            />
          </label>
          {(start || end || status || brand) && (
            <button
              onClick={() => {
                setStart("");
                setEnd("");
                setStatus("");
                setBrand("");
              }}
            >
              Limpar
            </button>
          )}
        </div>
        {mode !== "all" && (
          <>
            <div className="marketing-calendar-nav">
              <button aria-label="Período anterior" onClick={() => move(-1)}>
                <ChevronLeft size={20} />
              </button>
              <strong>
                {mode === "month"
                  ? anchor.toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })
                  : `${days[0].split("-").reverse().join("/")} – ${days[6].split("-").reverse().join("/")}`}
              </strong>
              <button aria-label="Próximo período" onClick={() => move(1)}>
                <ChevronRight size={20} />
              </button>
              <button
                onClick={() => {
                  setCursor(today);
                  setSelected(today);
                }}
              >
                Hoje
              </button>
            </div>
            <div className="marketing-calendar">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <small key={d}>{d}</small>
              ))}
              {days.map((d) => {
                const count = filtered.filter((p) => p.date === d).length;
                return (
                  <button
                    key={d}
                    aria-label={`${humanDate(d)}, ${count} publicações`}
                    aria-pressed={selected === d}
                    className={`${d === today ? "is-today" : ""} ${d.slice(0, 7) !== cursor.slice(0, 7) ? "is-outside" : ""}`}
                    onClick={() => setSelected(d)}
                  >
                    <span>{Number(d.slice(-2))}</span>
                    <small>{count || "·"}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <p className="marketing-calendar-label">
          {mode === "all"
            ? "Todas as publicações"
            : mode === "week"
              ? "Publicações da semana"
              : humanDate(selected)}{" "}
          · {calendarPosts.length} conteúdos
        </p>
        <div className="marketing-posts">
          {calendarPosts.map((p) => (
            <div key={p.id}>
              <small className="marketing-date-label">
                {humanDate(p.date)}
              </small>
              <PostCard post={p} onOpen={() => edit(p)} />
            </div>
          ))}
          {!calendarPosts.length && (
            <p className="marketing-empty">Nenhuma publicação neste período.</p>
          )}
        </div>
      </section>
      {draft && (
        <Dialog
          title={draft.id ? "Editar publicação" : "Nova publicação"}
          onClose={() => !busy && setDraft(null)}
        >
          <form onSubmit={save} className="marketing-form">
            <div className="marketing-form-grid">
              {(
                ["brand", "network", "format", "title", "date", "time"] as const
              ).map((field, i) => (
                <label key={field}>
                  {
                    [
                      "Marca",
                      "Rede (se informada)",
                      "Formato",
                      "Título",
                      "Data",
                      "Horário (opcional)",
                    ][i]
                  }
                  {field === "brand" ? (
                    <select
                      required
                      value={draft.brand}
                      onChange={(e) =>
                        setDraft({ ...draft, brand: e.target.value })
                      }
                    >
                      {store.brands.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={field === "title" || field === "date"}
                      type={
                        field === "date"
                          ? "date"
                          : field === "time"
                            ? "time"
                            : "text"
                      }
                      value={draft[field]}
                      onChange={(e) =>
                        setDraft({ ...draft, [field]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as any })
                  }
                >
                  {MARKETING_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Instruções
              <textarea
                rows={4}
                value={draft.instructions}
                onChange={(e) =>
                  setDraft({ ...draft, instructions: e.target.value })
                }
              />
            </label>
            <label>
              Legenda
              <textarea
                rows={4}
                value={draft.caption}
                onChange={(e) =>
                  setDraft({ ...draft, caption: e.target.value })
                }
              />
            </label>
            <label>
              Anexos (imagens ou PDF, até 5 e 2 MB no total)
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  e.target.value = "";
                  try {
                    if (
                      files.length + draft.attachments.length > 5 ||
                      files.reduce((n, f) => n + f.size, 0) +
                        draft.attachments.reduce(
                          (n, a) => n + a.data.length * 0.75,
                          0,
                        ) >
                        2000000
                    )
                      throw new Error("Use até 5 anexos e 2 MB no total");
                    const attachments = await Promise.all(
                      files.map(
                        (f) =>
                          new Promise<{ name: string; data: string }>(
                            (resolve, reject) => {
                              const r = new FileReader();
                              r.onload = () =>
                                resolve({
                                  name: f.name,
                                  data: String(r.result),
                                });
                              r.onerror = () =>
                                reject(new Error("Falha ao ler anexo"));
                              r.readAsDataURL(f);
                            },
                          ),
                      ),
                    );
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            attachments: [...p.attachments, ...attachments],
                          }
                        : p,
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </label>
            {draft.attachments.map((a, i) => (
              <div key={i} className="marketing-attachment">
                <a href={a.data} download={a.name}>
                  {a.name}
                </a>
                <button
                  type="button"
                  aria-label={`Remover ${a.name}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      attachments: draft.attachments.filter((_, j) => i !== j),
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <fieldset>
              <legend>Métricas registradas manualmente</legend>
              <div className="marketing-form-grid">
                {METRICS.map((m, i) => (
                  <label key={m}>
                    {metricNames[i]}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.metrics[m] ?? ""}
                      onChange={(e) => {
                        const metrics = { ...draft.metrics };
                        if (e.target.value === "") delete metrics[m];
                        else metrics[m] = Number(e.target.value);
                        setDraft({ ...draft, metrics });
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            {draft.source && (
              <p className="marketing-source">Fonte: {draft.source}</p>
            )}
            {error && (
              <p role="alert" className="marketing-alert">
                {error}
              </p>
            )}
            <div className="marketing-actions">
              <button disabled={busy} className="marketing-primary">
                {busy ? "Salvando…" : "Salvar publicação"}
              </button>
              {draft.id && (
                <>
                  <button type="button" disabled={busy} onClick={duplicate}>
                    <Copy size={17} />
                    Duplicar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Excluir esta publicação?"))
                        run(async () => {
                          await marketingRequest(
                            "/posts/" + draft.id,
                            "DELETE",
                            undefined,
                            draft.version,
                          );
                          setDraft(null);
                          setNotice("Publicação excluída.");
                        });
                    }}
                  >
                    <Trash2 size={17} />
                    Excluir
                  </button>
                </>
              )}
            </div>
            <p className="marketing-source">
              Para reagendar, altere a data e o horário e salve.
            </p>
          </form>
        </Dialog>
      )}
      {importOpen && (
        <Dialog
          title="Importar do ChatGPT"
          onClose={() => !busy && setImportOpen(false)}
        >
          <div className="marketing-form">
            <p>
              Cole o JSON gerado pelo ChatGPT ou selecione um arquivo. Até 100
              publicações por lote. Campos ausentes ficam vazios; status e data
              são obrigatórios.
            </p>
            <details>
              <summary>Modelo de JSON</summary>
              <pre>
                {JSON.stringify(
                  [
                    {
                      brand: "Passione",
                      network: "",
                      format: "Story",
                      title: "Título da publicação",
                      instructions: "",
                      caption: "",
                      date: "2026-11-23",
                      time: "",
                      status: "Planejado",
                    },
                  ],
                  null,
                  2,
                )}
              </pre>
            </details>
            <label>
              Arquivo JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 9000000) {
                      setError("Arquivo excede 9 MB");
                      return;
                    }
                    setRaw(await f.text());
                    setPreview(null);
                  }
                }}
              />
            </label>
            <label>
              JSON
              <textarea
                rows={9}
                aria-label="JSON"
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <button
              className="marketing-primary"
              onClick={() => {
                try {
                  setPreview(parseImport(raw));
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                  setPreview(null);
                }
              }}
            >
              Validar e visualizar
            </button>
            {preview && (
              <>
                <p>
                  {uniquePreview().length} novas ·{" "}
                  {preview.length - uniquePreview().length} duplicadas
                  (ignoradas)
                </p>
                {preview.length > uniquePreview().length && (
                  <button className="marketing-view-saved" onClick={showSaved}>
                    Ver publicações já cadastradas
                  </button>
                )}
                <div className="marketing-import-preview">
                  {preview.map((p, i) => (
                    <p key={i}>
                      {p.date} · {p.time || "A definir"} · {p.brand} ·{" "}
                      {p.network || "Rede não informada"} · {p.format} ·{" "}
                      {p.title} · {p.status}
                      <br />
                      {p.instructions}
                      {p.caption && (
                        <>
                          <br />
                          Legenda: {p.caption}
                        </>
                      )}
                    </p>
                  ))}
                </div>
                <button
                  className="marketing-primary"
                  disabled={busy || !uniquePreview().length}
                  onClick={() =>
                    run(async () => {
                      const r = await marketingRequest(
                        "/import",
                        "POST",
                        preview,
                      );
                      showSaved();
                      setRaw("");
                      setNotice(
                        `${r.inserted} publicações importadas; ${r.duplicates} duplicadas ignoradas.`,
                      );
                    })
                  }
                >
                  {busy ? "Importando…" : "Confirmar importação"}
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="marketing-alert">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
      {brandOpen && (
        <Dialog
          title="Adicionar marca"
          onClose={() => !busy && setBrandOpen(false)}
        >
          <form
            className="marketing-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await marketingRequest("/brands", "POST", { name: brandName });
                setBrandOpen(false);
                setBrandName("");
              });
            }}
          >
            <label>
              Nome da marca
              <input
                required
                maxLength={100}
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="marketing-primary" disabled={busy}>
              Adicionar marca
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
