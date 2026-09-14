/**
 * Log de auditoria — tipos e rótulos compartilhados.
 *
 * Os registros são gerados no banco (triggers em `public.logs_auditoria`) e no
 * servidor (`registra_log`). Só a diretoria consegue ler (RLS).
 */

export const CATEGORIAS_LOG = [
  { id: "perfil", rotulo: "Perfil" },
  { id: "cargos", rotulo: "Cargos" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "pagamento", rotulo: "Pagamentos" },
  { id: "lista", rotulo: "Lista do baba" },
  { id: "convidados", rotulo: "Convidados" },
  { id: "punicoes", rotulo: "Punições" },
  { id: "metas", rotulo: "Metas" },
  { id: "agenda", rotulo: "Agenda" },
  { id: "sessoes", rotulo: "Sessões" },
  { id: "associacao", rotulo: "Associação" },
  { id: "sistema", rotulo: "Sistema" },
] as const;

export type CategoriaLog = (typeof CATEGORIAS_LOG)[number]["id"];

/** Uma alteração de campo registrada pelo log ("de → para"). */
export interface MudancaLog {
  campo: string;
  rotulo: string;
  /** Valor anterior (null em criação). */
  de: string | null;
  /** Valor novo (null em remoção). */
  para: string | null;
}

export interface LogAuditoria {
  id: string;
  criado_em: string;
  ator_id: string | null;
  ator_nome: string;
  origem: string;
  categoria: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  alvo_id: string | null;
  alvo_nome: string | null;
  descricao: string;
  mudancas: MudancaLog[] | null;
  detalhes: Record<string, unknown> | null;
  metodo_pagamento: string | null;
}

export function rotuloCategoria(id: string): string {
  return CATEGORIAS_LOG.find((c) => c.id === id)?.rotulo ?? "Outros";
}

/** Quem agiu: a diretoria (painel), o próprio jogador (app) ou o sistema. */
export function rotuloOrigem(origem: string): string {
  if (origem === "painel") return "Diretoria";
  if (origem === "app") return "Próprio jogador";
  return "Sistema";
}

/** Nome curto da forma de pagamento (para badges). */
export function rotuloMetodoPagamento(metodo: string | null | undefined): string | null {
  if (!metodo) return null;
  if (metodo === "pix") return "PIX";
  if (metodo === "debito") return "Débito";
  if (metodo === "credito") return "Crédito";
  if (metodo === "boleto") return "Boleto";
  if (metodo === "transferencia") return "Transferência";
  return metodo;
}

/**
 * Normaliza o tipo de pagamento informado pelo Mercado Pago
 * (`payment_type_id` / `payment_method_id`) para os códigos do app.
 */
export function normalizarMetodoMp(
  paymentTypeId?: string | null,
  paymentMethodId?: string | null,
): "pix" | "debito" | "credito" | "boleto" | "transferencia" | null {
  const tipo = (paymentTypeId ?? "").toLowerCase();
  const meio = (paymentMethodId ?? "").toLowerCase();
  if (meio === "pix" || tipo === "bank_transfer" || tipo === "account_money") return "pix";
  if (tipo === "credit_card") return "credito";
  if (tipo === "debit_card") return "debito";
  if (tipo === "ticket") return "boleto";
  return null;
}

/** Lê a lista de mudanças gravada em `jsonb`, tolerando formatos inesperados. */
export function parseMudancas(valor: unknown): MudancaLog[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      campo: String(item.campo ?? ""),
      rotulo: String(item.rotulo ?? item.campo ?? ""),
      de: item.de === null || item.de === undefined ? null : String(item.de),
      para: item.para === null || item.para === undefined ? null : String(item.para),
    }))
    .filter((m) => m.campo !== "");
}
