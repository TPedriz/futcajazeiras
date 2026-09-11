import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VALOR_MENSALIDADE, VALOR_CONVIDADO } from "@/lib/mercadopago.server";

export interface PixResposta {
  status: string;
  pago: boolean;
  qrCode: string | null;
  qrBase64: string | null;
  expiraEm: string | null;
  valor: number;
  /** Acréscimo por atraso embutido no valor cobrado (0 quando não há). */
  multa?: number;
}

export interface RegularizacaoResposta {
  regularizacaoId: string;
  status: string;
  pago: boolean;
  qrCode: string | null;
  qrBase64: string | null;
  expiraEm: string | null;
  /** Total cobrado: débitos retroativos + multas + Taxa de Associação. */
  valor: number;
  valorDebitos: number;
  taxaAssociacao: number;
}

export const criarPixMensalidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mensalidadeId: z.string().uuid() }).parse(d))
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
    const valor = base + multa;

    if (mensalidade.status === "pago") {
      return {
        status: "approved",
        pago: true,
        qrCode: null,
        qrBase64: null,
        expiraEm: null,
        valor,
        multa,
      };
    }

    const aindaValido =
      mensalidade.pix_qr_code &&
      mensalidade.mp_status === "pending" &&
      (!mensalidade.pix_expira_em || new Date(mensalidade.pix_expira_em) > new Date());

    if (aindaValido) {
      return {
        status: "pending",
        pago: false,
        qrCode: mensalidade.pix_qr_code,
        qrBase64: mensalidade.pix_qr_base64,
        expiraEm: mensalidade.pix_expira_em,
        valor,
        multa,
      };
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { criarPagamentoPix, emailPagador } = await import("@/lib/mercadopago.server");
    const pix = await criarPagamentoPix({
      valor,
      descricao:
        multa > 0
          ? `Mensalidade + multa Fut Cajazeiras — ${mensalidade.referencia}`
          : `Mensalidade Fut Cajazeiras — ${mensalidade.referencia}`,
      email: emailPagador(perfil?.telefone, userId),
      nome: perfil?.nome ?? "Associado",
      externalReference: `mensalidade:${mensalidade.id}`,
      idempotencyKey: `mensalidade-${mensalidade.id}-${Date.now()}`,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("mensalidades")
      .update({
        mp_payment_id: pix.paymentId,
        mp_status: pix.status,
        pix_qr_code: pix.qrCode,
        pix_qr_base64: pix.qrBase64,
        pix_expira_em: pix.expiraEm,
        // Mantém o valor BASE na mensalidade; a multa é cobrada no PIX.
        valor: base,
      })
      .eq("id", mensalidade.id);

    return {
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor,
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
      .select("id, usuario_id, status, mp_payment_id")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (!mensalidade || mensalidade.usuario_id !== userId)
      throw new Error("Mensalidade não encontrada");
    if (mensalidade.status === "pago") return { pago: true, status: "approved" };
    if (!mensalidade.mp_payment_id) return { pago: false, status: "sem_cobranca" };

    const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
    const pagamento = await consultarPagamentoMp(mensalidade.mp_payment_id);

    const { aplicarPagamento } = await import("@/lib/pagamentos.server");
    await aplicarPagamento(`mensalidade:${mensalidade.id}`, pagamento.status);

    return { pago: pagamento.status === "approved", status: pagamento.status };
  });

export const criarPixConvidado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ babaId: z.string().uuid(), nome: z.string().trim().min(2).max(80) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PixResposta & { presencaId: string }> => {
    const { supabase, userId } = context;

    const { criarPagamentoPix, emailPagador, valorConvidadoAtual } =
      await import("@/lib/mercadopago.server");
    const valor = await valorConvidadoAtual();

    const { data: existente } = await supabase
      .from("presencas")
      .select("id")
      .eq("baba_id", data.babaId)
      .eq("usuario_id", userId)
      .not("nome_convidado", "is", null)
      .maybeSingle();
    if (existente) throw new Error("Você já tem um convidado nesse baba");

    const { data: presenca, error } = await supabase
      .from("presencas")
      .insert({
        baba_id: data.babaId,
        usuario_id: userId,
        nome_convidado: data.nome,
        status_convidado: "pendente",
        valor,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const pix = await criarPagamentoPix({
      valor,
      descricao: `Taxa de convidado — ${data.nome}`,
      email: emailPagador(perfil?.telefone, userId),
      nome: perfil?.nome ?? "Associado",
      externalReference: `convidado:${presenca.id}`,
      idempotencyKey: `convidado-${presenca.id}`,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("presencas").update({ mp_status: pix.status }).eq("id", presenca.id);
    await supabaseAdmin.from("presencas_pagamento").upsert(
      {
        presenca_id: presenca.id,
        mp_payment_id: pix.paymentId,
        pix_qr_code: pix.qrCode,
        pix_qr_base64: pix.qrBase64,
        pix_expira_em: pix.expiraEm,
      },
      { onConflict: "presenca_id" },
    );

    return {
      presencaId: presenca.id,
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor,
    };
  });

export const consultarPixConvidado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presencaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: presenca } = await supabase
      .from("presencas")
      .select("id, usuario_id, convidado_user_id, status_convidado")
      .eq("id", data.presencaId)
      .maybeSingle();
    if (!presenca || (presenca.usuario_id !== userId && presenca.convidado_user_id !== userId)) {
      throw new Error("Convidado não encontrado");
    }

    // O valor é lido no servidor: a coluna não é exposta a usuários logados.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: valorPresenca } = await supabaseAdmin
      .from("presencas")
      .select("valor")
      .eq("id", presenca.id)
      .maybeSingle();

    const { data: cobranca } = await supabase
      .from("presencas_pagamento")
      .select("mp_payment_id, pix_qr_code, pix_qr_base64")
      .eq("presenca_id", presenca.id)
      .maybeSingle();

    const pix = {
      qrCode: cobranca?.pix_qr_code ?? null,
      qrBase64: cobranca?.pix_qr_base64 ?? null,
      valor: Number(valorPresenca?.valor) > 0 ? Number(valorPresenca?.valor) : VALOR_CONVIDADO,
    };

    if (presenca.status_convidado === "aprovado") return { pago: true, status: "approved", ...pix };
    if (!cobranca?.mp_payment_id) return { pago: false, status: "sem_cobranca", ...pix };

    const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
    const pagamento = await consultarPagamentoMp(cobranca.mp_payment_id);

    const { aplicarPagamento } = await import("@/lib/pagamentos.server");
    await aplicarPagamento(`convidado:${presenca.id}`, pagamento.status);

    return { pago: pagamento.status === "approved", status: pagamento.status, ...pix };
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

/** Gera um PIX para pagar a mensalidade de outra pessoa. */
export const criarPixPresente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mensalidadeId: z.string().uuid() }).parse(d))
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
    const valor = base + multa;

    if (mensalidade.status === "pago") {
      return {
        status: "approved",
        pago: true,
        qrCode: null,
        qrBase64: null,
        expiraEm: null,
        valor,
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
    const pix = await criarPagamentoPix({
      valor,
      descricao: `Presente de mensalidade para ${nome} — ${mensalidade.referencia}`,
      email: emailPagador(pagador?.telefone, userId),
      nome: pagador?.nome ?? "Associado",
      externalReference: `mensalidade:${mensalidade.id}`,
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
        // Mantém o valor BASE; a multa é cobrada junto no PIX.
        valor: base,
      })
      .eq("id", mensalidade.id);

    return {
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor,
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
      .select("id, status, mp_payment_id")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (!mensalidade) throw new Error("Mensalidade não encontrada");
    if (mensalidade.status === "pago") return { pago: true, status: "approved" };
    if (!mensalidade.mp_payment_id) return { pago: false, status: "sem_cobranca" };

    const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
    const pagamento = await consultarPagamentoMp(mensalidade.mp_payment_id);
    const { aplicarPagamento } = await import("@/lib/pagamentos.server");
    await aplicarPagamento(`mensalidade:${mensalidade.id}`, pagamento.status);
    return { pago: pagamento.status === "approved", status: pagamento.status };
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
  .handler(async ({ context }): Promise<RegularizacaoResposta> => {
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

    const valor = Number(reg.valor_total);
    const valorDebitos = Number(reg.valor_debitos);
    const taxaAssociacao = Number(reg.taxa_associacao);

    if (reg.status === "pago") {
      return {
        regularizacaoId: reg.id,
        status: "approved",
        pago: true,
        qrCode: null,
        qrBase64: null,
        expiraEm: null,
        valor,
        valorDebitos,
        taxaAssociacao,
      };
    }

    const { data: cobranca } = await supabaseAdmin
      .from("regularizacoes_pagamento")
      .select("*")
      .eq("regularizacao_id", reg.id)
      .maybeSingle();

    const aindaValido =
      cobranca?.pix_qr_code &&
      cobranca?.mp_status === "pending" &&
      (!cobranca.pix_expira_em || new Date(cobranca.pix_expira_em) > new Date());

    if (aindaValido) {
      return {
        regularizacaoId: reg.id,
        status: "pending",
        pago: false,
        qrCode: cobranca!.pix_qr_code,
        qrBase64: cobranca!.pix_qr_base64,
        expiraEm: cobranca!.pix_expira_em,
        valor,
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
    const pix = await criarPagamentoPix({
      valor,
      descricao: "Regularização de associação — Fut Cajazeiras",
      email: emailPagador(perfil?.telefone, userId),
      nome: perfil?.nome ?? "Associado",
      externalReference: `regularizacao:${reg.id}`,
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
      regularizacaoId: reg.id,
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor,
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cobranca } = await supabaseAdmin
      .from("regularizacoes_pagamento")
      .select("mp_payment_id")
      .eq("regularizacao_id", reg.id)
      .maybeSingle();
    if (!cobranca?.mp_payment_id)
      return { pago: false, status: "sem_cobranca", regularizacaoId: reg.id };

    const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
    const pagamento = await consultarPagamentoMp(cobranca.mp_payment_id);

    const { aplicarPagamento } = await import("@/lib/pagamentos.server");
    await aplicarPagamento(`regularizacao:${reg.id}`, pagamento.status);

    return {
      pago: pagamento.status === "approved",
      status: pagamento.status,
      regularizacaoId: reg.id,
    };
  });
