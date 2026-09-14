// Aplica o resultado de um pagamento Mercado Pago no banco. Somente servidor.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function aplicarPagamento(externalReference: string, status: string) {
  const [tipo, id] = externalReference.split(":");
  if (!tipo || !id) return { aplicado: false };

  const aprovado = status === "approved";

  if (tipo === "mensalidade") {
    const { error } = await supabaseAdmin
      .from("mensalidades")
      .update({
        mp_status: status,
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
        ...(aprovado ? { status_convidado: "aprovado" as const } : {}),
      })
      .eq("id", id);
    if (error) throw error;
    return { aplicado: aprovado };
  }

  if (tipo === "meta") {
    // Confirma a contribuição e atualiza a arrecadação (função SECURITY DEFINER no banco).
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
  if (!pagamento) return { status: "sem_cobranca", pago: false };
  await aplicarPagamento(externalReference, pagamento.status);
  return { status: pagamento.status, pago: pagamento.status === "approved" };
}
