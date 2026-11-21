import { useCallback, useEffect, useState, useRef } from "react";
import type { MarketingPost } from "../utils/marketing";
export async function marketingRequest(
  path = "",
  method = "GET",
  body?: unknown,
  version?: string,
) {
  const res = await fetch("/api/marketing" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(version ? { "If-Match": version } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res
    .json()
    .catch(() => ({ error: "Servidor indisponível" }));
  if (!res.ok) throw new Error(data.error || "Não foi possível concluir");
  return data;
}
export function useMarketing() {
  const [posts, setPosts] = useState<MarketingPost[]>([]),
    [brands, setBrands] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      const data = await marketingRequest();
      if (!Array.isArray(data.posts) || !Array.isArray(data.brands))
        throw new Error("Resposta inválida ao carregar Marketing");
      if (current !== generation.current) return;
      setPosts(data.posts);
      setBrands(data.brands);
      setError("");
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    const focus = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [reload]);
  return { posts, brands, error, loading, reload };
}
