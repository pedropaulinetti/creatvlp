import * as React from "react";
import type { Draft } from "./tipos";

const STORAGE_KEY = "creatvos:onboarding";

export const rascunhoVazio = (): Draft => ({
  brandId: crypto.randomUUID(),
  company: "", website: "", segment: "", description: "",
  colors: [], logoPath: null, referencePaths: [],
  products: [], audience: "", audiencePains: [], voiceTone: "",
  recommendedWords: [], forbiddenWords: [], channels: [], formats: ["4:5"], cadence: "Semanal",
  typography: { headline: "", body: "" },
  fontFiles: [],
});

/**
 * O rascunho sobrevive a recarregar a página.
 *
 * Onboarding é o pior momento para perder trabalho: a pessoa ainda não tem
 * conta com nada dentro, e recomeçar do zero é motivo de desistência.
 */
export function useRascunho() {
  const [draft, setDraft] = React.useState<Draft>(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado) {
      try {
        return { ...rascunhoVazio(), ...(JSON.parse(guardado) as Draft) };
      } catch {
        /* rascunho corrompido: começa do zero */
      }
    }
    return rascunhoVazio();
  });

  const [retomado] = React.useState(() => Boolean(localStorage.getItem(STORAGE_KEY)));

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const aplicar = React.useCallback(
    (valores: Partial<Draft>) => setDraft((atual) => ({ ...atual, ...valores })),
    [],
  );

  const limpar = React.useCallback(() => localStorage.removeItem(STORAGE_KEY), []);

  /** Joga fora o que estava salvo e recomeça — inclusive o id da marca. */
  const descartar = React.useCallback(() => {
    limpar();
    setDraft(rascunhoVazio());
  }, [limpar]);

  return { draft, aplicar, retomado, limpar, descartar };
}

/** Completude da marca: sinal simples, sem gamificação. */
export function completeness(draft: {
  company: string; website: string; segment: string; description: string;
  colors: unknown[]; logoPath: string | null; products: unknown[];
  audience: string; voiceTone: string; channels: unknown[]; formats: unknown[];
}): number {
  const checks = [
    draft.company.trim().length > 1,
    draft.website.trim().length > 0,
    draft.segment.trim().length > 0,
    draft.description.trim().length > 0,
    draft.colors.length > 0,
    Boolean(draft.logoPath),
    draft.products.length > 0,
    draft.audience.trim().length > 0,
    draft.voiceTone.trim().length > 0,
    draft.channels.length > 0,
    draft.formats.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
