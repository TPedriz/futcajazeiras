// Cobrança no Mercado Pago (PIX ou cartão de crédito/débito). Somente servidor.
import { z } from "zod";
import type { CobrancaCalculada, DadosCobranca, MetodoPagamento } from "@/lib/taxasPagamento";
import type { PixCriado } from "@/lib/mercadopago.server";

/**
 * Método de pagamento aceito pelas server functions de cobrança.
 * Ausente = PIX (compatível com o comportamento anterior).
 */
export const metodoPagamento = z.enum(["pix", "debito", "credito"]).default("pix");

/** Calcula base + taxa (arredondada para cima) do método escolhido. */
export async function cobrancaDoMetodo(
  valorBase: number,
  metodo: MetodoPagamento,
): Promise<CobrancaCalculada> {
  const { cobrancaComTaxa } = await import("@/lib/mercadopago.server");
  return cobrancaComTaxa(valorBase, metodo);
}

/** Cobrança calculada (sem cobrança criada) no formato do diálogo. */
export function dadosCalculados(
  cobranca: CobrancaCalculada,
  metodo: MetodoPagamento,
): DadosCobranca {
  return {
    metodo,
    qrCode: null,
    qrBase64: null,
    checkoutUrl: null,
    expiraEm: null,
    valorBase: cobranca.valorBase,
    taxaPercentual: cobranca.taxaPercentual,
    taxa: cobranca.taxa,
    valor: cobranca.total,
  };
}

/** Empacota um PIX do Mercado Pago no formato do diálogo. */
export function dadosDoPix(
  pix: PixCriado,
  cobranca: CobrancaCalculada,
  metodo: MetodoPagamento = "pix",
): DadosCobranca {
  return {
    ...dadosCalculados(cobranca, metodo),
    qrCode: pix.qrCode,
    qrBase64: pix.qrBase64,
    expiraEm: pix.expiraEm,
  };
}

/**
 * Cria a cobrança no cartão (Checkout Pro) e devolve o link para onde o
 * pagador deve ir. A confirmação chega pelo webhook / pela volta do checkout.
 */
export async function cobrarNoCartao(opts: {
  metodo: "credito" | "debito";
  cobranca: CobrancaCalculada;
  descricao: string;
  email: string;
  externalReference: string;
  /** Caminho interno para onde o Mercado Pago devolve o usuário. */
  retorno: string;
  idempotencyKey: string;
}): Promise<DadosCobranca> {
  const { criarPreferenciaCartao, urlCheckout } = await import("@/lib/mercadopago.server");
  const preferencia = await criarPreferenciaCartao({
    metodo: opts.metodo,
    valor: opts.cobranca.total,
    descricao: opts.descricao,
    email: opts.email,
    externalReference: opts.externalReference,
    retorno: opts.retorno,
    idempotencyKey: opts.idempotencyKey,
  });
  return {
    ...dadosCalculados(opts.cobranca, opts.metodo),
    checkoutUrl: urlCheckout(preferencia),
  };
}
