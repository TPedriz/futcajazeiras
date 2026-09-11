/**
 * Financeiro — status de associação, multas por atraso e retomada de vínculo.
 *
 * Regras (espelham as funções do banco):
 *  - Mensalidade vencida e pendente recebe multa configurável (padrão R$ 5,00).
 *  - 1 mês de atraso => conta `INADIMPLENTE` (direitos de associação suspensos).
 *  - Retomada do vínculo (`ATIVO`) exige quitar os débitos + Taxa de Associação.
 *
 * NOTA INTERNA: a diretoria (papel `administrador`) é imune a multas e à
 * suspensão. Essa exceção NÃO deve aparecer em documentação pública.
 */

export type StatusConta = "ATIVO" | "INADIMPLENTE";

export const ROTULOS_STATUS_CONTA: Record<StatusConta, string> = {
  ATIVO: "Ativo",
  INADIMPLENTE: "Inadimplente",
};

/** Normaliza um valor vindo do banco para o estado da conta. */
export function normalizaStatusConta(valor: string | null | undefined): StatusConta {
  return valor === "INADIMPLENTE" ? "INADIMPLENTE" : "ATIVO";
}

export function rotuloStatusConta(valor: string | null | undefined): string {
  return ROTULOS_STATUS_CONTA[normalizaStatusConta(valor)];
}

export function estaInadimplente(valor: string | null | undefined): boolean {
  return normalizaStatusConta(valor) === "INADIMPLENTE";
}

/** Uma mensalidade em aberto dentro da situação financeira do associado. */
export interface MensalidadePendente {
  mensalidadeId: string;
  referencia: string;
  vencimento: string;
  valor: number;
  multa: number;
  total: number;
  atrasada: boolean;
}

export interface SituacaoFinanceira {
  usuarioId: string | null;
  statusConta: StatusConta;
  ehDiretoria: boolean;
  mensalidades: MensalidadePendente[];
  totalDebitos: number;
  valorMulta: number;
  taxaAssociacao: number;
  totalRegularizacao: number;
  atrasadas: number;
}

export const SITUACAO_FINANCEIRA_VAZIA: SituacaoFinanceira = {
  usuarioId: null,
  statusConta: "ATIVO",
  ehDiretoria: false,
  mensalidades: [],
  totalDebitos: 0,
  valorMulta: 0,
  taxaAssociacao: 0,
  totalRegularizacao: 0,
  atrasadas: 0,
};

function numero(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Converte o retorno JSONB de `pendencias_financeiras` em um objeto tipado. */
export function parseSituacaoFinanceira(json: unknown): SituacaoFinanceira {
  if (!json || typeof json !== "object") return SITUACAO_FINANCEIRA_VAZIA;
  const bruto = json as Record<string, unknown>;

  const mensalidades = Array.isArray(bruto.mensalidades)
    ? (bruto.mensalidades as Record<string, unknown>[]).map((m) => {
        const valor = numero(m.valor);
        const multa = numero(m.multa);
        return {
          mensalidadeId: String(m.mensalidadeId ?? ""),
          referencia: String(m.referencia ?? ""),
          vencimento: String(m.vencimento ?? ""),
          valor,
          multa,
          total: numero(m.total) || valor + multa,
          atrasada: m.atrasada === true,
        };
      })
    : [];

  return {
    usuarioId: bruto.usuarioId ? String(bruto.usuarioId) : null,
    statusConta: normalizaStatusConta(bruto.statusConta as string | undefined),
    ehDiretoria: bruto.ehDiretoria === true,
    mensalidades,
    totalDebitos: numero(bruto.totalDebitos),
    valorMulta: numero(bruto.valorMulta),
    taxaAssociacao: numero(bruto.taxaAssociacao),
    totalRegularizacao: numero(bruto.totalRegularizacao),
    atrasadas: mensalidades.filter((m) => m.atrasada).length,
  };
}

/** Total de uma mensalidade considerando o acréscimo por atraso. */
export function totalMensalidade(valor: number | string, multa: number | string): number {
  return numero(valor) + numero(multa);
}

/** Mensalidade está atrasada? (vencida e ainda não paga) */
export function mensalidadeAtrasada(vencimento: string | null | undefined, pago: boolean): boolean {
  if (pago || !vencimento) return false;
  return new Date(`${vencimento}T23:59:59`) < new Date();
}
