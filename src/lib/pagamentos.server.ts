// Aplica o resultado de um pagamento Mercado Pago no banco. Somente servidor.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizarMetodoMp } from "@/lib/logs";

/**
 * Aplica o status do pagamento na tabela correspondente.
 * `metodo` (pix/debito/credito) é a forma informada pelo Mercado Pago — quando
 * existe, sobrescreve o que o app registrou na criação da cobrança. O trigger
 * de auditoria usa essa mudança para registrar a forma de pagamento no log.
 */
export async function aplicarPagamento(
  externalReference: string,
  status: string,
  metodo?: string | null,
) {
  const [tipo, id] = externalReference.split(":");
  if (!tipo || !id) return { aplicado: false };

  const aprovado = status === "approved";
  const metodoCampo = metodo ? { metodo_pagamento: metodo } : {};

  if (tipo === "mensalidade") {
    const { error } = await supabaseAdmin
      .from("mensalidades")
      .update({
        mp_status: status,
        ...metodoCampo,
        ...(aprovado ? { status: "pago" as const, pago_em: new Date().toISOString() } : {}),
      })
      .eq("id", id);
    if (error) throw error;
    return { aplicado: aprovado };
  }

  if (tipo === "convidado") {
    const { error } = await supabaseAdmin
      .from("presencas")
      .update({
        mp_status: status,
        ...metodoCampo,
        ...(aprovado ? { status_convidado: "aprovado" as const } : {}),
      })
      .eq("id", id);
    if (error) throw error;
    return { aplicado: aprovado };
  }

  if (tipo === "meta") {
    // Confirma a contribuição e atualiza a arrecadação (função SECURITY DEFINER no banco).
    if (metodo) {
      await supabaseAdmin.from("contribuicoes_meta").update(metodoCampo).eq("id", id);
    }
    if (aprovado) {
      const { error } = await supabaseAdmin.rpc("confirmar_contribuicao_meta", {
        p_contribuicao_id: id,
      });
      if (error) throw error;
    }
    return { aplicado: aprovado };
  }

  if (tipo === "regularizacao") {
    // Quita os débitos do associado e devolve o vínculo (função SECURITY DEFINER).
    if (metodo) {
      await supabaseAdmin.from("regularizacoes").update(metodoCampo).eq("id", id);
    }
    if (aprovado) {
      const { error } = await supabaseAdmin.rpc("confirmar_regularizacao", {
        _regularizacao_id: id,
      });
      if (error) throw error;
    }
    return { aplicado: aprovado };
  }

  return { aplicado: false };
}

/**
 * Confirma uma cobrança direto na API do Mercado Pago, pela referência externa,
 * e aplica o resultado no banco.
 *
 * Funciona para PIX (cobrança transparente) e cartão (Checkout Pro) e é
 * resistente a várias tentativas de cobrança para a mesma referência — procura
 * qualquer pagamento aprovado antes de dizer que está pendente.
 */
export async function sincronizarPorReferencia(externalReference: string) {
  const { consultarPagamentoPorReferencia } = await import("@/lib/mercadopago.server");
  const pagamento = await consultarPagamentoPorReferencia(externalReference);
  if (!pagamento) return { status: "sem_cobranca", pago: false, metodo: null };
  const metodo = normalizarMetodoMp(pagamento.paymentTypeId, pagamento.paymentMethodId);
  await aplicarPagamento(externalReference, pagamento.status, metodo);
  return { status: pagamento.status, pago: pagamento.status === "approved", metodo };
}
