import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cobrancaDoMetodo,
  cobrarNoCartao,
  dadosCalculados,
  dadosDoPix,
  metodoPagamento,
} from "@/lib/cobranca.server";
import type { CobrancaResposta } from "@/lib/taxasPagamento";

export type PixMetaResposta = CobrancaResposta & {
  contribuicaoId: string;
};

/**
 * Cria uma cobrança (PIX ou cartão) para uma contribuição já cadastrada (pendente).
 *
 * Fluxo:
 *  - Arrecadação aberta: o cliente insere a contribuição (valor livre) e chama este.
 *  - Arrecadação por item: o cliente usa `cadastrar_interesse_item` (valor fixo) e chama este.
 * O valor base é sempre o da contribuição (fixo no item, escolhido na aberta); a
 * taxa da forma de pagamento é somada por cima.
 */
export const criarPixMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ contribuicaoId: z.string().uuid(), metodo: metodoPagamento }).parse(d),
  )
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
      .select("id, titulo, status, tipo_arrecadacao, valor_item, exige_personalizacao")
      .eq("id", contribuicao.meta_id)
      .maybeSingle();
    if (!meta) throw new Error("Meta não encontrada");
    if (meta.status !== "ativa") throw new Error("Esta meta não está mais ativa");

    // Arrecadação por item: valor deve ser o fixo definido na meta.
    // A personalização (nome/tamanho/número) só é exigida quando a meta pede —
    // itens genéricos (ex.: colete comum) usam o tamanho padrão.
    if (meta.tipo_arrecadacao === "item") {
      if (Number(contribuicao.valor) !== Number(meta.valor_item))
        throw new Error("Valor da contribuição não confere com o item");
      if (
        meta.exige_personalizacao &&
        (!contribuicao.nome_camisa || !contribuicao.tamanho || !contribuicao.numero_camisa)
      ) {
        throw new Error("Complete os dados de personalização do item");
      }
    }

    const cobranca = await cobrancaDoMetodo(Number(contribuicao.valor), data.metodo);

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { criarPagamentoPix, emailPagador } = await import("@/lib/mercadopago.server");
    const email = emailPagador(perfil?.telefone, userId);
    const descricao = `Contribuição: ${meta.titulo}`;
    const externalReference = `meta:${contribuicao.id}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.metodo !== "pix") {
      const dados = await cobrarNoCartao({
        metodo: data.metodo,
        cobranca,
        descricao,
        email,
        externalReference,
        retorno: "/metas",
        idempotencyKey: `meta-${contribuicao.id}-${data.metodo}-${Date.now()}`,
      });
      await supabaseAdmin.from("contribuicoes_meta_pagamento").upsert(
        {
          contribuicao_id: contribuicao.id,
          pix_qr_code: null,
          pix_qr_base64: null,
          pix_expira_em: null,
        },
        { onConflict: "contribuicao_id" },
      );
      return { ...dados, contribuicaoId: contribuicao.id, status: "pending", pago: false };
    }

    const pix = await criarPagamentoPix({
      valor: cobranca.total,
      descricao,
      email,
      nome: perfil?.nome ?? "Associado",
      externalReference,
      idempotencyKey: `meta-${contribuicao.id}-${Date.now()}`,
    });

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
      ...dadosDoPix(pix, cobranca),
      contribuicaoId: contribuicao.id,
      status: pix.status,
      pago: pix.status === "approved",
    };
  });

/** Consulta o status de uma contribuição e confirma quando aprovada. */
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

    // Confirma na API do Mercado Pago (PIX ou cartão) e aplica no banco.
    const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
    return await sincronizarPorReferencia(`meta:${contribuicao.id}`);
  });
