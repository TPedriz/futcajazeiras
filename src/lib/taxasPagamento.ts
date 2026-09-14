/**
 * Taxas por forma de pagamento (cobradas do pagador).
 *
 * O valor final cobrado é `valorBase + taxa`, com a taxa SEMPRE arredondada
 * para cima até o centavo — assim o valor líquido que cai na conta do Mercado
 * Pago no mesmo dia é exatamente o valor base (a taxa cobre o custo de
 * recebimento/repasses do Mercado Pago).
 *
 * As taxas ficam em `configuracoes` (`taxa_pix`, `taxa_debito`, `taxa_credito`)
 * e podem ser ajustadas pela diretoria em Admin › Financeiro.
 *
 * Este módulo é seguro para cliente e servidor (não importa nada de servidor).
 */

export type MetodoPagamento = "pix" | "credito" | "debito";

export const METODOS_PAGAMENTO: MetodoPagamento[] = ["pix", "debito", "credito"];

/** Percentuais padrão (Mercado Pago) usados enquanto a diretoria não ajustar. */
export const TAXAS_PADRAO: Record<MetodoPagamento, number> = {
  pix: 0,
  debito: 1.99,
  credito: 4.99,
};

/** Chave em `configuracoes` que guarda o percentual de cada método. */
export const CHAVES_TAXA: Record<MetodoPagamento, string> = {
  pix: "taxa_pix",
  debito: "taxa_debito",
  credito: "taxa_credito",
};

export const ROTULO_METODO: Record<MetodoPagamento, string> = {
  pix: "PIX",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
};

export const DESCRICAO_METODO: Record<MetodoPagamento, string> = {
  pix: "Aprovação na hora, sem taxa extra.",
  debito: "Aprovação na hora. Cobre a taxa de recebimento no mesmo dia.",
  credito: "Em até 3x com juros do Mercado Pago. Cobre a taxa de recebimento no mesmo dia.",
};

/** Arredonda um valor para baixo até o centavo (evita centavos “sujos” de float). */
export function arredondarCentavos(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.floor(valor * 100 + 1e-9) / 100;
}

/**
 * Taxa em reais, arredondada **para cima** até o centavo.
 * Ex.: R$ 20,00 com 4,99% => R$ 1,00 (0,998 arredonda para cima).
 */
export function calcularTaxa(valorBase: number, percentual: number): number {
  if (!Number.isFinite(percentual) || percentual <= 0) return 0;
  const bruto = (valorBase * percentual) / 100;
  if (!Number.isFinite(bruto) || bruto <= 0) return 0;
  // O epsilon evita que erros de ponto flutuante empurrem valores exatos
  // (ex.: 1,00) para o centavo seguinte.
  return Math.ceil(bruto * 100 - 1e-9) / 100;
}

export interface CobrancaCalculada {
  valorBase: number;
  taxaPercentual: number;
  /** Taxa em reais (arredondada para cima). */
  taxa: number;
  /** Total cobrado do pagador. */
  total: number;
}

/** Calcula base + taxa (arredondada para cima) de um método de pagamento. */
export function calcularCobranca(valorBase: number, percentual: number): CobrancaCalculada {
  const base = arredondarCentavos(valorBase);
  const taxa = calcularTaxa(base, percentual);
  return {
    valorBase: base,
    taxaPercentual: Number(percentual) || 0,
    taxa,
    total: arredondarCentavos(base + taxa),
  };
}

export function metodosComTaxa(taxas: Record<MetodoPagamento, number>, valorBase: number) {
  return METODOS_PAGAMENTO.map((metodo) => ({
    metodo,
    ...calcularCobranca(valorBase, taxas[metodo] ?? 0),
  }));
}

/** Cobrança já criada no Mercado Pago, pronta para o diálogo de pagamento. */
export interface DadosCobranca {
  metodo: MetodoPagamento;
  /** QR Code (PIX copia-e-cola). */
  qrCode: string | null;
  /** Imagem do QR Code em base64 (PIX). */
  qrBase64: string | null;
  /** Link do Checkout Pro (cartão de crédito/débito). */
  checkoutUrl: string | null;
  expiraEm: string | null;
  valorBase: number;
  taxaPercentual: number;
  /** Taxa em reais cobrada do pagador (arredondada para cima). */
  taxa: number;
  /** Total cobrado do pagador (base + taxa). */
  valor: number;
}

/** Resposta padrão das server functions de cobrança. */
export interface CobrancaResposta extends DadosCobranca {
  status: string;
  pago: boolean;
}
