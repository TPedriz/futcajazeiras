import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PixResposta {
  status: string;
  pago: boolean;
  qrCode: string | null;
  qrBase64: string | null;
  expiraEm: string | null;
  valor: number;
}

export const criarPixMensalidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mensalidadeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PixResposta> => {
    const { supabase, userId } = context;
    const { data: mensalidade, error } = await supabase
      .from("mensalidades")
      .select("*")
      .eq("id", data.mensalidadeId)
      .maybeSingle();
    if (error) throw error;
    if (!mensalidade || mensalidade.usuario_id !== userId)
      throw new Error("Mensalidade não encontrada");

    const valor = Number(mensalidade.valor) > 0 ? Number(mensalidade.valor) : 15;

    if (mensalidade.status === "pago") {
      return {
        status: "approved",
        pago: true,
        qrCode: null,
        qrBase64: null,
        expiraEm: null,
        valor,
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
      descricao: `Mensalidade Fut Cajazeiras — ${mensalidade.referencia}`,
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
        valor,
      })
      .eq("id", mensalidade.id);

    return {
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor,
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
      .select("id, usuario_id, convidado_user_id, status_convidado, valor")
      .eq("id", data.presencaId)
      .maybeSingle();
    if (!presenca || (presenca.usuario_id !== userId && presenca.convidado_user_id !== userId)) {
      throw new Error("Convidado não encontrado");
    }

    const { data: cobranca } = await supabase
      .from("presencas_pagamento")
      .select("mp_payment_id, pix_qr_code, pix_qr_base64")
      .eq("presenca_id", presenca.id)
      .maybeSingle();

    const pix = {
      qrCode: cobranca?.pix_qr_code ?? null,
      qrBase64: cobranca?.pix_qr_base64 ?? null,
      valor: Number(presenca.valor) > 0 ? Number(presenca.valor) : 5,
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
        .select("id, usuario_id, referencia, valor")
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
        valor: Number(m.valor) > 0 ? Number(m.valor) : 15,
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
    const valor = Number(mensalidade.valor) > 0 ? Number(mensalidade.valor) : 15;

    if (mensalidade.status === "pago") {
      return {
        status: "approved",
        pago: true,
        qrCode: null,
        qrBase64: null,
        expiraEm: null,
        valor,
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
        valor,
      })
      .eq("id", mensalidade.id);

    return {
      status: pix.status,
      pago: pix.status === "approved",
      qrCode: pix.qrCode,
      qrBase64: pix.qrBase64,
      expiraEm: pix.expiraEm,
      valor,
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
