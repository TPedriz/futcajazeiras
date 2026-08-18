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

// ============================================================================
// XP, níveis e conquistas — mesmas regras do banco de dados.
// ============================================================================

/** XP concedido por evento (espelha os triggers do banco). */
export const XP_POR_EVENTO = {
  presenca: 15,
  gol: 8,
  assistencia: 5,
} as const;

export type EventoXp = keyof typeof XP_POR_EVENTO;

export function ganhoXp(evento: EventoXp): number {
  return XP_POR_EVENTO[evento];
}

/**
 * XP cumulativo necessário para alcançar um nível.
 * Regra do banco: 75 * nivel * (nivel - 1) / 2.
 * Nível 1 = 0, nível 2 = 75, nível 3 = 225, nível 4 = 450, nível 5 = 750...
 */
export function xpNecessariaParaNivel(nivel: number): number {
  if (nivel <= 1) return 0;
  return (75 * nivel * (nivel - 1)) / 2;
}

/** Nível correspondente a um total de XP (inverso de xpNecessariaParaNivel). */
export function nivelParaXp(xp: number): number {
  const seguro = Math.max(0, Math.floor(xp));
  return Math.floor((1 + Math.sqrt(1 + (8 * seguro) / 75)) / 2);
}

export interface ProgressoNivel {
  nivel: number;
  xp: number;
  /** XP já conquistado dentro do nível atual. */
  xpNoNivel: number;
  /** XP necessário para subir do nível atual para o próximo. */
  xpParaProximo: number;
  /** Progresso de 0 a 1 dentro do nível atual. */
  progresso: number;
}

/** Detalhes de progresso do nível atual a partir do XP total. */
export function progressoNivel(xp: number): ProgressoNivel {
  const nivel = nivelParaXp(xp);
  const xpNoNivel = xp - xpNecessariaParaNivel(nivel);
  const xpParaProximo = xpNecessariaParaNivel(nivel + 1) - xpNecessariaParaNivel(nivel);
  return {
    nivel,
    xp,
    xpNoNivel,
    xpParaProximo,
    progresso: xpParaProximo > 0 ? Math.min(1, xpNoNivel / xpParaProximo) : 1,
  };
}

/** Conquista do catálogo (tabela `conquistas`). */
export interface Conquista {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  categoria: string;
  meta: number;
  raridade?: string;
  historica?: boolean;
}

/** Conquista desbloqueada por um usuário (tabela `usuario_conquistas`). */
export interface UsuarioConquista {
  id: string;
  usuario_id?: string;
  conquista_id: string;
  desbloqueada_em: string;
  em_destaque: boolean;
  ordem_destaque: number | null;
  conquistas: Conquista | null;
}

/** Categorias de conquista com rótulo em português. */
export const ROTULOS_CATEGORIA_CONQUISTA: Record<string, string> = {
  presenca: "Presenças",
  gols: "Gols",
  assistencias: "Assistências",
  nivel: "Nível",
  xp: "XP total",
  penaltis: "Pênaltis defendidos",
  vitorias: "Vitórias",
  cartoes: "Cartões amarelos",
  cartoes_vermelhos: "Cartões vermelhos",
  faltas: "Faltas",
  gols_contra: "Gols contra",
  bavi: "BAxVI",
};

export function rotuloCategoriaConquista(categoria: string): string {
  return ROTULOS_CATEGORIA_CONQUISTA[categoria] ?? categoria;
}
