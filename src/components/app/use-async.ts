"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Carrega dados assíncronos identificados por uma chave. Trocar a chave dispara uma nova
 * consulta; enquanto a resposta da chave atual não chega, `data` é null (sem setState
 * síncrono dentro do efeito, como exige o lint do React Compiler).
 * key null = não consultar.
 */
export function useAsync<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown } | null>(null);
  const [version, setVersion] = useState(0);
  const fullKey = key === null ? null : `${key}#${version}`;

  useEffect(() => {
    if (fullKey === null) return;
    let active = true;
    fetcher().then(
      (data) => {
        if (active) setState({ key: fullKey, data });
      },
      (error: unknown) => {
        if (active) setState({ key: fullKey, error });
      },
    );
    return () => {
      active = false;
    };
    // A chave identifica a consulta; o fetcher é recriado a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const current = state && state.key === fullKey ? state : null;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: (current?.data ?? null) as T | null, error: current?.error ?? null, loading: fullKey !== null && !current, reload };
}
