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

  return { aplicado: false };
}
