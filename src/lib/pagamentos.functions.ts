import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VALOR_MENSALIDADE } from "@/lib/mercadopago.server";
import {
  cobrancaDoMetodo,
  cobrarNoCartao,
  dadosCalculados,
  dadosDoPix,
  metodoPagamento,
} from "@/lib/cobranca.server";
import type { CobrancaResposta } from "@/lib/taxasPagamento";

export type PixResposta = CobrancaResposta & {
  /** Acréscimo por atraso embutido no valor base cobrado (0 quando não há). */
  multa?: number;
};

export type RegularizacaoResposta = CobrancaResposta & {
  regularizacaoId: string;
  /** Débitos retroativos + multas (sem a Taxa de Associação). */
  valorDebitos: number;
  taxaAssociacao: number;
};

export const criarPixMensalidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mensalidadeId: z.string().uuid(), metodo: metodoPagamento }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PixResposta> => {
    const { supabase, userId } = context;

    // Recalcula multa/status antes de cobrar (rotina idempotente no banco).
    await supabase.rpc("atualiza_situacao_financeira", { _usuario_id: userId });

    const { data: mensalidade, error } = await supabase
      .from("mensalidades")
      .select("*")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (error) throw error;
    if (!mensalidade || mensalidade.usuario_id !== userId)
      throw new Error("Mensalidade não encontrada");

    const base = Number(mensalidade.valor) > 0 ? Number(mensalidade.valor) : VALOR_MENSALIDADE;
    const multa = Number(mensalidade.multa_valor ?? 0);
    // Valor base (mensalidade + multa) + taxa da forma de pagamento escolhida.
    const cobranca = await cobrancaDoMetodo(base + multa, data.metodo);

    if (mensalidade.status === "pago") {
      return {
        ...dadosCalculados(cobranca, data.metodo),
        status: "approved",
        pago: true,
        multa,
      };
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { criarPagamentoPix, emailPagador } = await import("@/lib/mercadopago.server");
    const email = emailPagador(perfil?.telefone, userId);
    const nome = perfil?.nome ?? "Associado";
    const descricao =
      multa > 0
        ? `Mensalidade + multa Fut Cajazeiras — ${mensalidade.referencia}`
        : `Mensalidade Fut Cajazeiras — ${mensalidade.referencia}`;
    const externalReference = `mensalidade:${mensalidade.id}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.metodo !== "pix") {
      // Cartão de crédito/débito: checkout do Mercado Pago.
      const dados = await cobrarNoCartao({
        metodo: data.metodo,
        cobranca,
        descricao,
        email,
        externalReference,
        retorno: "/pagamentos",
        idempotencyKey: `mensalidade-${mensalidade.id}-${data.metodo}-${Date.now()}`,
      });
      await supabaseAdmin
        .from("mensalidades")
        .update({
          mp_status: "pending",
          pix_qr_code: null,
          pix_qr_base64: null,
          pix_expira_em: null,
          // Mantém o valor BASE na mensalidade; taxa e multa vão na cobrança.
          valor: base,
        })
        .eq("id", mensalidade.id);
      return { ...dados, status: "pending", pago: false, multa };
    }

    const pix = await criarPagamentoPix({
      valor: cobranca.total,
      descricao,
      email,
      nome,
      externalReference,
      idempotencyKey: `mensalidade-${mensalidade.id}-${Date.now()}`,
    });

    await supabaseAdmin
      .from("mensalidades")
      .update({
        mp_payment_id: pix.paymentId,
        mp_status: pix.status,
        pix_qr_code: pix.qrCode,
        pix_qr_base64: pix.qrBase64,
        pix_expira_em: pix.expiraEm,
        // Mantém o valor BASE na mensalidade; taxa e multa vão na cobrança.
        valor: base,
      })
      .eq("id", mensalidade.id);

    return {
      ...dadosDoPix(pix, cobranca),
      status: pix.status,
      pago: pix.status === "approved",
      multa,
    };
  });

export const consultarPixMensalidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mensalidadeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mensalidade } = await supabase
      .from("mensalidades")
      .select("id, usuario_id, status")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (!mensalidade || mensalidade.usuario_id !== userId)
      throw new Error("Mensalidade não encontrada");
    if (mensalidade.status === "pago") return { pago: true, status: "approved" };

    // Confirma na API do Mercado Pago (PIX ou cartão) e aplica no banco.
    const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
    return await sincronizarPorReferencia(`mensalidade:${mensalidade.id}`);
  });

/** Lista associados com mensalidade em aberto (para presentear). */
export const listarMensalidadesPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ mensalidadeId: string; nome: string; referencia: string; valor: number }[]> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: pendentes } = await supabaseAdmin
        .from("mensalidades")
        .select("id, usuario_id, referencia, valor, multa_valor")
        .eq("status", "pendente")
        .order("referencia", { ascending: false });

      const outras = (pendentes ?? []).filter((m) => m.usuario_id !== context.userId);
      const ids = Array.from(new Set(outras.map((m) => m.usuario_id)));
      if (ids.length === 0) return [];
      const { data: perfis } = await supabaseAdmin
        .from("perfis_publicos")
        .select("id, nome")
        .in("id", ids);
      const nomes = new Map((perfis ?? []).map((p) => [p.id, p.nome]));

      return outras.map((m) => ({
        mensalidadeId: m.id,
        nome: nomes.get(m.usuario_id) ?? "Associado",
        referencia: m.referencia,
        valor:
          (Number(m.valor) > 0 ? Number(m.valor) : VALOR_MENSALIDADE) + Number(m.multa_valor ?? 0),
      }));
    },
  );

/** Gera uma cobrança (PIX ou cartão) para pagar a mensalidade de outra pessoa. */
export const criarPixPresente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mensalidadeId: z.string().uuid(), metodo: metodoPagamento }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PixResposta & { nome: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mensalidade } = await supabaseAdmin
      .from("mensalidades")
      .select("*")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (!mensalidade) throw new Error("Mensalidade não encontrada");

    const { data: presenteado } = await supabaseAdmin
      .from("perfis_publicos")
      .select("nome")
      .eq("id", mensalidade.usuario_id)
      .maybeSingle();
    const nome = presenteado?.nome ?? "Associado";
    const base = Number(mensalidade.valor) > 0 ? Number(mensalidade.valor) : VALOR_MENSALIDADE;
    const multa = Number(mensalidade.multa_valor ?? 0);
    const cobranca = await cobrancaDoMetodo(base + multa, data.metodo);

    if (mensalidade.status === "pago") {
      return {
        ...dadosCalculados(cobranca, data.metodo),
        status: "approved",
        pago: true,
        multa,
        nome,
      };
    }

    const { data: pagador } = await supabaseAdmin
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { criarPagamentoPix, emailPagador } = await import("@/lib/mercadopago.server");
    const email = emailPagador(pagador?.telefone, userId);
    const descricao = `Presente de mensalidade para ${nome} — ${mensalidade.referencia}`;
    const externalReference = `mensalidade:${mensalidade.id}`;

    if (data.metodo !== "pix") {
      const dados = await cobrarNoCartao({
        metodo: data.metodo,
        cobranca,
        descricao,
        email,
        externalReference,
        retorno: "/pagamentos",
        idempotencyKey: `presente-${mensalidade.id}-${data.metodo}-${Date.now()}`,
      });
      await supabaseAdmin
        .from("mensalidades")
        .update({
          mp_status: "pending",
          pix_qr_code: null,
          pix_qr_base64: null,
          pix_expira_em: null,
          valor: base,
        })
        .eq("id", mensalidade.id);
      return { ...dados, status: "pending", pago: false, multa, nome };
    }

    const pix = await criarPagamentoPix({
      valor: cobranca.total,
      descricao,
      email,
      nome: pagador?.nome ?? "Associado",
      externalReference,
      idempotencyKey: `presente-${mensalidade.id}-${Date.now()}`,
    });

    await supabaseAdmin
      .from("mensalidades")
      .update({
        mp_payment_id: pix.paymentId,
        mp_status: pix.status,
        pix_qr_code: pix.qrCode,
        pix_qr_base64: pix.qrBase64,
        pix_expira_em: pix.expiraEm,
        // Mantém o valor BASE; taxa e multa vão na cobrança.
        valor: base,
      })
      .eq("id", mensalidade.id);

    return {
      ...dadosDoPix(pix, cobranca),
      status: pix.status,
      pago: pix.status === "approved",
      multa,
      nome,
    };
  });

/** Consulta o pagamento de um presente (qualquer autenticado que gerou a cobrança). */
export const consultarPixPresente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mensalidadeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mensalidade } = await supabaseAdmin
      .from("mensalidades")
      .select("id, status")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (!mensalidade) throw new Error("Mensalidade não encontrada");
    if (mensalidade.status === "pago") return { pago: true, status: "approved" };

    const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
    return await sincronizarPorReferencia(`mensalidade:${mensalidade.id}`);
  });

// ============================================================================
// Retomada de vínculo (inadimplência): débitos + multas + Taxa de Associação
// em uma única cobrança PIX.
// ============================================================================

/**
 * Cria (ou reaproveita) a regularização do associado inadimplente e devolve o
 * PIX com o total a pagar. O cálculo é feito no banco (idempotente): gera os
 * meses retroativos desde o último pagamento, aplica as multas e soma a taxa.
 */
export const criarPixRegularizacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ metodo: metodoPagamento }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<RegularizacaoResposta> => {
    const { supabase, userId } = context;

    const { data: regularizacaoId, error } = await supabase.rpc("criar_regularizacao", {
      _usuario_id: userId,
    });
    if (error) throw error;
    if (!regularizacaoId) throw new Error("Não foi possível montar a regularização");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("regularizacoes")
      .select("*")
      .eq("id", regularizacaoId)
      .maybeSingle();
    if (!reg || reg.usuario_id !== userId) throw new Error("Regularização não encontrada");

    const valorDebitos = Number(reg.valor_debitos);
    const taxaAssociacao = Number(reg.taxa_associacao);
    // Base = débitos + multas + Taxa de Associação; depois a taxa da forma de pagamento.
    const cobranca = await cobrancaDoMetodo(Number(reg.valor_total), data.metodo);

    if (reg.status === "pago") {
      return {
        ...dadosCalculados(cobranca, data.metodo),
        regularizacaoId: reg.id,
        status: "approved",
        pago: true,
        valorDebitos,
        taxaAssociacao,
      };
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { criarPagamentoPix, emailPagador } = await import("@/lib/mercadopago.server");
    const email = emailPagador(perfil?.telefone, userId);
    const descricao = "Regularização de associação — Fut Cajazeiras";
    const externalReference = `regularizacao:${reg.id}`;

    if (data.metodo !== "pix") {
      const dados = await cobrarNoCartao({
        metodo: data.metodo,
        cobranca,
        descricao,
        email,
        externalReference,
        retorno: "/pagamentos",
        idempotencyKey: `regularizacao-${reg.id}-${data.metodo}-${Date.now()}`,
      });
      await supabaseAdmin.from("regularizacoes_pagamento").upsert(
        {
          regularizacao_id: reg.id,
          mp_status: "pending",
          pix_qr_code: null,
          pix_qr_base64: null,
          pix_expira_em: null,
        },
        { onConflict: "regularizacao_id" },
      );
      return {
        ...dados,
        regularizacaoId: reg.id,
        status: "pending",
        pago: false,
        valorDebitos,
        taxaAssociacao,
      };
    }

    const pix = await criarPagamentoPix({
      valor: cobranca.total,
      descricao,
      email,
      nome: perfil?.nome ?? "Associado",
      externalReference,
      idempotencyKey: `regularizacao-${reg.id}-${Date.now()}`,
    });

    await supabaseAdmin.from("regularizacoes_pagamento").upsert(
      {
        regularizacao_id: reg.id,
        mp_payment_id: pix.paymentId,
        mp_status: pix.status,
        pix_qr_code: pix.qrCode,
        pix_qr_base64: pix.qrBase64,
        pix_expira_em: pix.expiraEm,
      },
      { onConflict: "regularizacao_id" },
    );

    return {
      ...dadosDoPix(pix, cobranca),
      regularizacaoId: reg.id,
      status: pix.status,
      pago: pix.status === "approved",
      valorDebitos,
      taxaAssociacao,
    };
  });

/** Consulta o PIX da regularização e confirma quando aprovado. */
export const consultarPixRegularizacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ regularizacaoId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let regId = data.regularizacaoId ?? null;
    if (!regId) {
      const { data: pendente } = await supabase
        .from("regularizacoes")
        .select("id")
        .eq("usuario_id", userId)
        .eq("status", "pendente")
        .maybeSingle();
      regId = pendente?.id ?? null;
    }
    // Sem pendência: nada a pagar.
    if (!regId) return { pago: true, status: "approved", regularizacaoId: null as string | null };

    const { data: reg } = await supabase
      .from("regularizacoes")
      .select("id, usuario_id, status")
      .eq("id", regId)
      .maybeSingle();
    if (!reg || reg.usuario_id !== userId) throw new Error("Regularização não encontrada");
    if (reg.status === "pago") return { pago: true, status: "approved", regularizacaoId: reg.id };

    // Confirma na API do Mercado Pago (PIX ou cartão) e aplica no banco.
    const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
    const resultado = await sincronizarPorReferencia(`regularizacao:${reg.id}`);
    return { ...resultado, regularizacaoId: reg.id };
  });

/**
 * Confirma a cobrança quando o usuário volta do checkout do Mercado Pago.
 * O Mercado Pago devolve `external_reference` na URL de retorno; reconsultamos
 * o pagamento na API antes de aplicar qualquer coisa (nada é confiado da URL).
 */
export const confirmarPagamentoRetorno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        externalReference: z
          .string()
          .trim()
          .regex(
            /^(mensalidade|convidado|meta|regularizacao):[0-9a-fA-F-]{36}$/,
            "Referência inválida",
          ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
    return await sincronizarPorReferencia(data.externalReference);
  });
