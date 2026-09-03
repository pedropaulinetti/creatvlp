/**
 * Níveis de qualidade da imagem-base.
 * Testar em escala pede volume barato; a peça que vai ao ar pede o melhor
 * modelo. Espelha IMAGE_MODELS nas Edge Functions — o servidor decide de fato,
 * aqui é só o que o usuário vê antes de confirmar.
 */
export const IMAGE_QUALITIES = ["rascunho", "padrao", "alta"] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export const IMAGE_QUALITY: Record<
  ImageQuality,
  { label: string; costUsd: number; description: string }
> = {
  rascunho: {
    label: "Rascunho",
    costUsd: 0.039,
    description: "Para varrer muitos ângulos rápido e descobrir o que merece atenção.",
  },
  padrao: {
    label: "Padrão",
    costUsd: 0.077,
    description: "Equilíbrio entre custo e acabamento. Serve para a maior parte dos testes.",
  },
  alta: {
    label: "Alta",
    costUsd: 0.155,
    description: "Melhor acabamento, para a peça que vai rodar com verba.",
  },
};

export const DEFAULT_IMAGE_QUALITY: ImageQuality = "padrao";

export function estimatedCost(quality: ImageQuality, count: number): number {
  return IMAGE_QUALITY[quality].costUsd * Math.max(0, count);
}
