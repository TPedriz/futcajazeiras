/**
 * Feed Social de Gamificação — helpers de domínio.
 *
 * Centraliza os conceitos do feed global de acontecimentos:
 * tipos de evento, raridade das conquistas, rótulos, ícones, tratamento
 * visual e renderização de texto a partir do metadata estruturado (JSONB).
 *
 * O frontend NUNCA decide quem ganhou conquista — apenas projeta o que o
 * backend (funções/triggers SECURITY DEFINER) já registrou em `feed_eventos`.
 */

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================================================
// Tipos de evento do feed (espelham a coluna `feed_eventos.tipo`).
// ============================================================================
export type TipoEventoFeed =
  | "CONQUISTA_DESBLOQUEADA"
  | "CONQUISTA_RARA"
  | "NIVEL_ALCANCADO"
  | "MARCA_ATINGIDA"
  | "RECORDE_PESSOAL"
  | "RANKING_ALCANCADO"
  | "EVENTO_HISTORICO"
  | "META_CRIADA"
  | "CONTRIBUICAO_CONFIRMADA"
  | "META_ATINGIDA";

/** Eventos considerados "importantes" — merecem toast de celebração próprio. */
export const EVENTOS_IMPORTANTES: ReadonlySet<TipoEventoFeed> = new Set([
  "CONQUISTA_RARA",
  "MARCA_ATINGIDA",
  "RANKING_ALCANCADO",
  "EVENTO_HISTORICO",
  "META_ATINGIDA",
]);

// ============================================================================
// Evento do feed (projeção para o frontend — só dados públicos).
// ============================================================================
export interface PerfilPublicoFeed {
  id: string;
  nome: string;
  avatar_url: string | null;
  time_coracao: "bahia" | "vitoria" | null;
}

export interface SocialEvento {
  id: string;
  tipo: string;
  usuario_id: string;
  conquista_id: string | null;
  titulo: string;
  descricao: string;
  metadata?: unknown;
  visibilidade?: string;
  criado_em: string;
  perfis_publicos?: PerfilPublicoFeed | null;
  conquistas?: {
    id: string;
    codigo: string;
    nome: string;
    icone: string;
    cor: string;
    raridade: string;
  } | null;
}

export const ROTULOS_TIPO_EVENTO: Record<TipoEventoFeed, string> = {
  CONQUISTA_DESBLOQUEADA: "Conquista desbloqueada",
  CONQUISTA_RARA: "Conquista rara!",
  NIVEL_ALCANCADO: "Nível alcançado",
  MARCA_ATINGIDA: "Marca atingida",
  RECORDE_PESSOAL: "Recorde pessoal",
  RANKING_ALCANCADO: "Ranking",
  EVENTO_HISTORICO: "Evento histórico",
  META_CRIADA: "Nova meta",
  CONTRIBUICAO_CONFIRMADA: "Contribuição",
  META_ATINGIDA: "Meta atingida!",
};

export function rotuloTipoEvento(tipo: string): string {
  return ROTULOS_TIPO_EVENTO[tipo as TipoEventoFeed] ?? tipo;
}

// ============================================================================
// Raridade das conquistas (espelha a coluna `conquistas.raridade`).
// ============================================================================
export type RaridadeConquista = "comum" | "incomum" | "rara" | "epica" | "lendaria" | "mitica";

export const RARIDADES: RaridadeConquista[] = [
  "comum",
  "incomum",
  "rara",
  "epica",
  "lendaria",
  "mitica",
];

export const ROTULOS_RARIDADE: Record<RaridadeConquista, string> = {
  comum: "Comum",
  incomum: "Incomum",
  rara: "Rara",
  epica: "Épica",
  lendaria: "Lendária",
  mitica: "Mítica",
};

export function rotuloRaridade(raridade?: string | null): string {
  if (raridade && raridade in ROTULOS_RARIDADE) {
    return ROTULOS_RARIDADE[raridade as RaridadeConquista];
  }
  return ROTULOS_RARIDADE.comum;
}

/**
 * Tratamento visual por raridade (fiel ao design system: tokens semânticos,
 * glow discreto nas raras+, opaco quando bloqueada).
 */
export function classesRaridade(raridade?: string | null, desbloqueada = true): string {
  if (!desbloqueada) {
    return "border-border/50 bg-muted/40 opacity-45 grayscale";
  }
  switch (raridade) {
    case "incomum":
      return "border-sky-400/50 bg-sky-400/10 text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.25)]";
    case "rara":
      return "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.3)]";
    case "epica":
      return "border-violet-400/50 bg-violet-400/10 text-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.35)]";
    case "lendaria":
      return "border-gold/60 bg-gold/10 text-gold shadow-[0_0_22px_rgba(217,167,86,0.45)]";
    case "mitica":
      return "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-300 shadow-[0_0_26px_rgba(232,121,249,0.5)]";
    case "comum":
    default:
      return "border-gold/40 bg-gold/5 text-gold shadow-[0_0_10px_rgba(217,167,86,0.15)]";
  }
}

export const ICONES_RARIDADE: Record<RaridadeConquista, string> = {
  comum: "⚪",
  incomum: "🔵",
  rara: "🟦",
  epica: "🟣",
  lendaria: "🟡",
  mitica: "💎",
};

export function iconeRaridade(raridade?: string | null): string {
  if (raridade && raridade in ICONES_RARIDADE) {
    return ICONES_RARIDADE[raridade as RaridadeConquista];
  }
  return ICONES_RARIDADE.comum;
}

// ============================================================================
// Metadata do evento (JSONB) — acesso tipado e seguro.
// ============================================================================
export interface MetadataEvento {
  raridade?: string;
  categoria?: string;
  meta?: number;
  icone?: string;
  nivel_anterior?: number;
  nivel_novo?: number;
  xp_total?: number;
  posicao_nova?: number;
  valor?: number;
  mes?: string;
  meta_id?: string;
  valor_alvo?: number;
  [key: string]: unknown;
}

export function metadataEvento(metadata: unknown): MetadataEvento {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    return metadata as MetadataEvento;
  }
  return {};
}

// ============================================================================
// Renderização de texto a partir do metadata (sem interpretar texto livre).
// ============================================================================
const ROTULOS_CATEGORIA: Record<string, string> = {
  gols: "gols",
  assistencias: "assistências",
  presenca: "presenças",
  penaltis: "pênaltis defendidos",
  vitorias: "vitórias",
};

function rotuloCategoria(categoria?: string): string {
  if (!categoria) return "";
  return ROTULOS_CATEGORIA[categoria] ?? categoria;
}

/** Texto de apoio do card (ex.: "100 gols pelo Fut Cajazeiras"). */
export function textoApoioEvento(evento: {
  tipo: string;
  descricao: string;
  metadata?: unknown;
}): string {
  const meta = metadataEvento(evento.metadata);
  if (evento.tipo === "NIVEL_ALCANCADO" && meta.nivel_novo) {
    return `${meta.xp_total ?? 0} XP acumulados`;
  }
  if (
    (evento.tipo === "CONQUISTA_RARA" || evento.tipo === "CONQUISTA_DESBLOQUEADA") &&
    meta.meta != null &&
    meta.categoria
  ) {
    return `${meta.meta} ${rotuloCategoria(meta.categoria)}`;
  }
  if (evento.tipo === "MARCA_ATINGIDA" && meta.meta != null && meta.categoria) {
    return `${meta.meta} ${rotuloCategoria(meta.categoria)} — marca histórica`;
  }
  if (evento.tipo === "RANKING_ALCANCADO" && meta.categoria) {
    const pos = meta.posicao_nova ?? 0;
    const prefixo = pos === 1 ? "1º lugar" : `${pos}º lugar`;
    return `${prefixo} do mês em ${rotuloCategoria(meta.categoria)}${meta.valor != null ? ` (${meta.valor})` : ""}`;
  }
  if (evento.tipo === "META_CRIADA" && meta.valor_alvo != null) {
    return `Meta coletiva de R$ ${Number(meta.valor_alvo).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    })}`;
  }
  if (evento.tipo === "CONTRIBUICAO_CONFIRMADA" && meta.valor != null) {
    return `Contribuiu com R$ ${Number(meta.valor).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    })}`;
  }
  return evento.descricao;
}

// ============================================================================
// Chaves de idempotência (espelham a coluna `feed_eventos.chave_unica` do banco).
// ============================================================================
/** Chave de um evento de conquista (mesma conquista = mesmo evento). */
export function chaveConquista(usuario: string, conquista: string): string {
  return `conquista:${usuario}:${conquista}`;
}

/** Chave de um evento de marca atingida (mesma conquista = mesmo evento). */
export function chaveMarca(usuario: string, conquista: string): string {
  return `marca:${usuario}:${conquista}`;
}

/** Chave de um evento de nível (nível específico = evento único). */
export function chaveNivel(usuario: string, nivel: number): string {
  return `nivel:${usuario}:${nivel}`;
}

/** Chave de um evento de ranking (categoria + faixa + mês = evento único). */
export function chaveRanking(
  usuario: string,
  mes: string,
  categoria: string,
  faixa: "top1" | "top3",
): string {
  return `ranking:${usuario}:${mes}:${categoria}:${faixa}`;
}

/** Chave de um evento histórico (usuário + conquista = evento único). */
export function chaveHistorico(usuario: string, conquista: string): string {
  return `historico:${usuario}:${conquista}`;
}

/** Chave de um evento de meta criada (meta = evento único). */
export function chaveMetaCriada(meta: string): string {
  return `meta_criada:${meta}`;
}

/** Chave de um evento de contribuição confirmada (contribuição = evento único). */
export function chaveContribuicao(contribuicao: string): string {
  return `contribuicao:${contribuicao}`;
}

/** Chave de um evento de meta atingida (meta = evento único). */
export function chaveMetaAtingida(meta: string): string {
  return `meta_atingida:${meta}`;
}

// ============================================================================
// Datas relativas (pt-BR, date-fns).
// ============================================================================
export function dataRelativa(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}
