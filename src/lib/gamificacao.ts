/**
 * Gamificação — Destaques do mês.
 *
 * Calcula a posição de cada usuário nas categorias do ranking mensal
 * (gols, assistências, pênaltis defendidos e cartões) para exibir
 * badges de destaque ao lado do nome.
 */

export type CategoriaDestaque = "gols" | "assistencias" | "penaltis" | "cartoes";

export interface LinhaRankingDestaque {
  usuario_id: string | null;
  gols: number | null;
  assistencias: number | null;
  penaltis_defendidos: number | null;
  cartoes_amarelos: number | null;
  cartoes_azuis: number | null;
  cartoes_vermelhos: number | null;
}

export interface Destaque {
  categoria: CategoriaDestaque;
  /** Posição (1 = líder). */
  posicao: number;
  /** Valor na categoria (ex.: número de gols). */
  valor: number;
}

export const ROTULOS_DESTAQUE: Record<CategoriaDestaque, string> = {
  gols: "Gols",
  assistencias: "Assistências",
  penaltis: "Pênaltis defendidos",
  cartoes: "Cartões",
};

const ICONES_DESTAQUE: Record<CategoriaDestaque, string> = {
  gols: "⚽",
  assistencias: "🅰️",
  penaltis: "🧤",
  cartoes: "🟥",
};

function totalCartoes(r: LinhaRankingDestaque): number {
  return (r.cartoes_amarelos ?? 0) + (r.cartoes_azuis ?? 0) + (r.cartoes_vermelhos ?? 0);
}

function valorDe(r: LinhaRankingDestaque, categoria: CategoriaDestaque): number {
  switch (categoria) {
    case "gols":
      return r.gols ?? 0;
    case "assistencias":
      return r.assistencias ?? 0;
    case "penaltis":
      return r.penaltis_defendidos ?? 0;
    case "cartoes":
      return totalCartoes(r);
  }
}

/** Monta o ranking ordenado de uma categoria (quem tem valor 0 fica fora). */
export function rankingDeCategoria(
  linhas: LinhaRankingDestaque[],
  categoria: CategoriaDestaque,
): { usuario_id: string; posicao: number; valor: number }[] {
  return linhas
    .filter((r) => r.usuario_id && valorDe(r, categoria) > 0)
    .sort((a, b) => valorDe(b, categoria) - valorDe(a, categoria))
    .map((r, i) => ({
      usuario_id: r.usuario_id!,
      posicao: i + 1,
      valor: valorDe(r, categoria),
    }));
}

/**
 * Destaques de um usuário: categorias onde ele está entre os primeiros.
 * @param limiteTop quantos primeiros contam como "destaque" (ex.: 3).
 */
export function destaquesDoUsuario(
  linhas: LinhaRankingDestaque[],
  usuarioId: string | undefined,
  limiteTop = 3,
): Destaque[] {
  if (!usuarioId) return [];
  const destaques: Destaque[] = [];
  const categorias: CategoriaDestaque[] = ["gols", "assistencias", "penaltis", "cartoes"];
  for (const categoria of categorias) {
    const ranking = rankingDeCategoria(linhas, categoria);
    const pos = ranking.findIndex((r) => r.usuario_id === usuarioId);
    if (pos >= 0 && pos < limiteTop) {
      destaques.push({
        categoria,
        posicao: pos + 1,
        valor: ranking[pos].valor,
      });
    }
  }
  return destaques.sort((a, b) => a.posicao - b.posicao);
}

export function iconeDestaque(categoria: CategoriaDestaque): string {
  return ICONES_DESTAQUE[categoria];
}
