import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PixMetaResposta {
  status: string;
  pago: boolean;
  qrCode: string | null;
  qrBase64: string | null;
  expiraEm: string | null;
  valor: number;
  contribuicaoId: string;
}

/**
 * Cria um PIX para uma contribuição já cadastrada (pendente).
 *
 * Fluxo:
 *  - Arrecadação aberta: o cliente insere a contribuição (valor livre) e chama este.
 *  - Arrecadação por item: o cliente usa `cadastrar_interesse_item` (valor fixo) e chama este.
 * O valor cobrado é sempre o da contribuição (fixo no item, escolhido na aberta).
 */
export const criarPixMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contribuicaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PixMetaResposta> => {
    const { supabase, userId } = context;

    const { data: contribuicao } = await supabase
      .from("contribuicoes_meta")
      .select("id, meta_id, user_id, valor, status, nome_camisa, tamanho, numero_camisa")
      .eq("id", data.contribuicaoId)
      .maybeSingle();
    if (!contribuicao || contribuicao.user_id !== userId)
      throw new Error("Contribuição não encontrada");
    if (contribuicao.status !== "pendente") throw new Error("Esta contribuição não está pendente");

    const { data: meta } = await supabase
      .from("metas")
      .select("id, titulo, status, tipo_arrecadacao, valor_item")
      .eq("id", contribuicao.meta_id)
      .maybeSingle();
    if (!meta) throw new Error("Meta não encontrada");
    if (meta.status !== "ativa") throw new Error("Esta meta não está mais ativa");

    // Arrecadação por item: valor deve ser o fixo e personalização preenchida
    // (garante que o cadastro passou pelo RPC cadastrar_interesse_item).
    if (meta.tipo_arrecadacao === "item") {
      if (Number(contribuicao.valor) !== Number(meta.valor_item))
        throw new Error("Valor da contribuição não confere com o item");
      if (!contribuicao.nome_camisa || !contribuicao.tamanho || !contribuicao.numero_camisa)
        throw new Error("Complete os dados de personalização do item");
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { criarPagamentoPix, emailPagador } = await import("@/lib/mercadopago.server");
    const pix = await criarPagamentoPix({
      valor: Number(contribuicao.valor),
      descricao: `Contribuição: ${meta.titulo}`,
      email: emailPagador(perfil?.telefone, userId),
      nome: perfil?.nome ?? "Associado",
      externalReference: `meta:${contribuicao.id}`,
      idempotencyKey: `meta-${contribuicao.id}`,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("contribuicoes_meta_pagamento").upsert(
      {
        contribuicao_id: contribuicao.id,
        mp_payment_id: pix.paymentId,
        pix_qr_code: pix.qrCode,
        pix_qr_base64: pix.qrBase64,
        pix_expira_em: pix.expiraEm,
      },
      { onConflict: "contribuicao_id" },
    );

    return {
      contribuicaoId: contribuicao.id,
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor: Number(contribuicao.valor),
    };
  });

/** Consulta o status de uma contribuição (PIX) e confirma quando aprovado. */
export const consultarPixMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contribuicaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: contribuicao } = await supabase
      .from("contribuicoes_meta")
      .select("id, user_id, status")
      .eq("id", data.contribuicaoId)
      .maybeSingle();
    if (!contribuicao || contribuicao.user_id !== userId)
      throw new Error("Contribuição não encontrada");

    if (contribuicao.status === "confirmada") return { pago: true, status: "approved" };

    const { data: pagamento } = await supabase
      .from("contribuicoes_meta_pagamento")
      .select("mp_payment_id")
      .eq("contribuicao_id", data.contribuicaoId)
      .maybeSingle();
    if (!pagamento?.mp_payment_id) return { pago: false, status: "sem_cobranca" };

    const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
    const mp = await consultarPagamentoMp(pagamento.mp_payment_id);

    const { aplicarPagamento } = await import("@/lib/pagamentos.server");
    await aplicarPagamento(`meta:${contribuicao.id}`, mp.status);

    return { pago: mp.status === "approved", status: mp.status };
  });
