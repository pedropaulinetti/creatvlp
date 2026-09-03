import type { Database } from "@/lib/database.types";

type Asset = Database["public"]["Tables"]["creative_assets"]["Row"];

export type Peca<T extends Asset> = {
  /** A versão principal — a do primeiro formato gerado. */
  principal: T;
  /** As outras versões de formato da mesma ideia. */
  irmas: T[];
};

/**
 * Uma peça por ideia, não por arquivo.
 *
 * Cada formato é uma geração e uma linha própria — é o que permite cobrar por
 * desenho em vez de por recorte. Mas na tela, o 4:5 e o 9:16 da mesma ideia
 * são a mesma peça em dois tamanhos: mostrá-los como dois cards fazia a
 * campanha parecer o dobro do que é, e deixava o seletor de formato sem função.
 *
 * Criativo antigo e peça gerada antes do `grupo_id` não têm grupo: cada um
 * segue sozinho, que é como sempre foi.
 */
export function agruparPorIdeia<T extends Asset>(assets: T[]): Peca<T>[] {
  const porGrupo = new Map<string, T[]>();
  const soltos: T[] = [];

  for (const asset of assets) {
    if (!asset.grupo_id) {
      soltos.push(asset);
      continue;
    }
    const grupo = porGrupo.get(asset.grupo_id) ?? [];
    grupo.push(asset);
    porGrupo.set(asset.grupo_id, grupo);
  }

  const agrupadas = [...porGrupo.values()].map((versoes) => ({
    principal: versoes[0],
    irmas: versoes.slice(1),
  }));

  return [...agrupadas, ...soltos.map((asset) => ({ principal: asset, irmas: [] as T[] }))];
}
