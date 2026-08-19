/**
 * Rede Social + Agenda + Metas — helpers de domínio compartilhados.
 *
 * Normalização de @Instagram, formatação de valores em R$ e cálculo de
 * progresso das metas coletivas. Mantém as regras consistentes em toda a UI.
 */

// ============================================================================
// Instagram
// ============================================================================

/** Remove @, espaços e caracteres inválidos. Aceita vazio (não obrigatório). */
export function normalizaInstagram(valor: string): string {
  return valor
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");
}

/** Formata para exibição com o @ na frente (retorna null se vazio). */
export function instagramFormatado(valor: string | null | undefined): string | null {
  const normalizado = normalizaInstagram(valor ?? "");
  return normalizado ? `@${normalizado}` : null;
}

/** Link do perfil do Instagram (null se não houver). */
export function instagramUrl(valor: string | null | undefined): string | null {
  const normalizado = normalizaInstagram(valor ?? "");
  return normalizado ? `https://instagram.com/${normalizado}` : null;
}

// ============================================================================
// Moeda (R$)
// ============================================================================

/** Formata um valor em reais (ex.: R$ 1.500,00). */
export function formatarReais(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ============================================================================
// Metas coletivas
// ============================================================================

export type StatusMeta = "ativa" | "encerrada" | "atingida";

export const ROTULOS_STATUS_META: Record<StatusMeta, string> = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  atingida: "Meta atingida!",
};

export const ROTULOS_CATEGORIA_META: Record<string, string> = {
  material_esportivo: "Material esportivo",
  eventos: "Eventos",
  resenha: "Resenha",
  infraestrutura: "Infraestrutura",
  uniforme: "Uniforme",
  outros: "Outros",
};

export function rotuloCategoriaMeta(categoria: string | null | undefined): string {
  return ROTULOS_CATEGORIA_META[categoria ?? ""] ?? "Outros";
}

export function rotuloStatusMeta(status: string | null | undefined): string {
  return ROTULOS_STATUS_META[(status ?? "ativa") as StatusMeta] ?? status ?? "Ativa";
}

export interface ProgressoMeta {
  arrecadado: number;
  alvo: number;
  restante: number;
  percentual: number;
}

/** Progresso de uma meta (arrecadado / alvo), com percentual capado em 100%. */
export function progressoMeta(
  arrecadado: number | null | undefined,
  alvo: number | null | undefined,
): ProgressoMeta {
  const valor = Number(arrecadado ?? 0);
  const alvoNumero = Number(alvo ?? 0);
  const restante = Math.max(0, alvoNumero - valor);
  const percentual = alvoNumero > 0 ? Math.min(100, Math.round((valor / alvoNumero) * 100)) : 0;
  return { arrecadado: valor, alvo: alvoNumero, restante, percentual };
}

// ============================================================================
// Agenda da Arena
// ============================================================================

export type StatusEventoAgenda = "agendado" | "cancelado" | "concluido";

export const ROTULOS_STATUS_EVENTO: Record<StatusEventoAgenda, string> = {
  agendado: "Agendado",
  cancelado: "Cancelado",
  concluido: "Concluído",
};

export const ROTULOS_CATEGORIA_EVENTO: Record<string, string> = {
  baba: "Baba",
  evento: "Evento",
  outro: "Outro",
};

export function rotuloCategoriaEvento(categoria: string | null | undefined): string {
  return ROTULOS_CATEGORIA_EVENTO[categoria ?? ""] ?? "Evento";
}

export function rotuloStatusEvento(status: string | null | undefined): string {
  return (
    ROTULOS_STATUS_EVENTO[(status ?? "agendado") as StatusEventoAgenda] ?? status ?? "Agendado"
  );
}

/** Formata hora "20:00:00" -> "20:00". */
export function formatarHora(hora: string | null | undefined): string {
  if (!hora) return "";
  return hora.slice(0, 5);
}

/** Nome curto do dia da semana (pt-BR). */
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function diaDaSemana(data: string | Date): string {
  return DIAS_SEMANA[new Date(data).getDay()];
}

export function diaDaSemanaCurto(data: string | Date): string {
  return DIAS_SEMANA_CURTO[new Date(data).getDay()];
}
