import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PixConvite {
  pago: boolean;
  status: string;
  qrCode: string | null;
  qrBase64: string | null;
  valor: number;
}

/** Lista associados e diretoria que podem receber uma solicitação de convite. */
export const listarAnfitrioes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ id: string; nome: string }[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: papeis } = await supabaseAdmin
      .from("papeis_usuario")
      .select("user_id, papel")
      .in("papel", ["associado", "administrador"]);
    const ids = Array.from(new Set((papeis ?? []).map((p) => p.user_id)));
    if (ids.length === 0) return [];
    const { data: perfis } = await supabaseAdmin
      .from("perfis_publicos")
      .select("id, nome")
      .in("id", ids)
      .order("nome", { ascending: true });
    return (perfis ?? []).map((p) => ({ id: p.id, nome: p.nome }));
  });

/** Convidado pede a um associado para ser levado ao baba. */
export const solicitarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ babaId: z.string().uuid(), anfitriaoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existente } = await supabase
      .from("solicitacoes_convidado")
      .select("id, status")
      .eq("baba_id", data.babaId)
      .eq("solicitante_id", userId)
      .neq("status", "rejeitado")
      .maybeSingle();
    if (existente) throw new Error("Você já tem uma solicitação em aberto para esse baba");

    const { data: nova, error } = await supabase
      .from("solicitacoes_convidado")
      .insert({ baba_id: data.babaId, solicitante_id: userId, anfitriao_id: data.anfitriaoId })
      .select("id")
      .single();
    if (error) throw error;
    return { solicitacaoId: nova.id };
  });

/** Associado aceita ou recusa. Ao aceitar, cria a presença de convidado e gera o PIX. */
export const responderSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ solicitacaoId: z.string().uuid(), aceitar: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sol, error } = await supabase
      .from("solicitacoes_convidado")
      .select("*")
      .eq("id", data.solicitacaoId)
      .maybeSingle();
    if (error) throw error;
    if (!sol || sol.anfitriao_id !== userId) throw new Error("Solicitação não encontrada");
    if (sol.status !== "pendente") throw new Error("Essa solicitação já foi respondida");

    if (!data.aceitar) {
      await supabase
        .from("solicitacoes_convidado")
        .update({ status: "rejeitado" })
        .eq("id", sol.id);
      return { aceito: false };
    }

    const { data: jaTem } = await supabase
      .from("presencas")
      .select("id")
      .eq("baba_id", sol.baba_id)
      .eq("usuario_id", userId)
      .not("nome_convidado", "is", null)
      .maybeSingle();
    if (jaTem) throw new Error("Você já tem um convidado nesse baba");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfilSolicitante } = await supabaseAdmin
      .from("perfis")
      .select("nome, telefone")
      .eq("id", sol.solicitante_id)
      .maybeSingle();

    const { data: presenca, error: erroPresenca } = await supabase
      .from("presencas")
      .insert({
        baba_id: sol.baba_id,
        usuario_id: userId,
        nome_convidado: perfilSolicitante?.nome ?? "Convidado",
        telefone_convidado: perfilSolicitante?.telefone ?? null,
        convidado_user_id: sol.solicitante_id,
        status_convidado: "pendente",
        valor: 5,
      })
      .select("id")
      .single();
    if (erroPresenca) throw erroPresenca;

    const { criarPagamentoPix, emailPagador, VALOR_CONVIDADO } = await import("@/lib/mercadopago.server");
    const pix = await criarPagamentoPix({
      valor: VALOR_CONVIDADO,
      descricao: `Taxa de convidado — ${perfilSolicitante?.nome ?? "Convidado"}`,
      email: emailPagador(perfilSolicitante?.telefone, sol.solicitante_id),
      nome: perfilSolicitante?.nome ?? "Convidado",
      externalReference: `convidado:${presenca.id}`,
      idempotencyKey: `convidado-${presenca.id}`,
    });

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


    await supabase
      .from("solicitacoes_convidado")
      .update({ status: "aprovado", presenca_id: presenca.id })
      .eq("id", sol.id);

    return { aceito: true, presencaId: presenca.id };
  });

/** PIX da solicitação — acessível ao convidado solicitante e ao anfitrião. */
export const pixDaSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ solicitacaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PixConvite> => {
    const { supabase, userId } = context;
    const { data: sol } = await supabase
      .from("solicitacoes_convidado")
      .select("id, solicitante_id, anfitriao_id, presenca_id")
      .eq("id", data.solicitacaoId)
      .maybeSingle();
    if (!sol || (sol.solicitante_id !== userId && sol.anfitriao_id !== userId)) {
      throw new Error("Solicitação não encontrada");
    }
    if (!sol.presenca_id) throw new Error("Ainda não há cobrança gerada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: presenca } = await supabaseAdmin
      .from("presencas")
      .select("id, status_convidado, mp_payment_id, pix_qr_code, pix_qr_base64, valor")
      .eq("id", sol.presenca_id)
      .maybeSingle();
    if (!presenca) throw new Error("Cobrança não encontrada");

    const base = {
      qrCode: presenca.pix_qr_code as string | null,
      qrBase64: presenca.pix_qr_base64 as string | null,
      valor: Number(presenca.valor) > 0 ? Number(presenca.valor) : 5,
    };

    if (presenca.status_convidado === "aprovado") return { pago: true, status: "approved", ...base };
    if (!presenca.mp_payment_id) return { pago: false, status: "sem_cobranca", ...base };

    const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
    const pagamento = await consultarPagamentoMp(presenca.mp_payment_id);
    const { aplicarPagamento } = await import("@/lib/pagamentos.server");
    await aplicarPagamento(`convidado:${presenca.id}`, pagamento.status);

    return { pago: pagamento.status === "approved", status: pagamento.status, ...base };
  });
