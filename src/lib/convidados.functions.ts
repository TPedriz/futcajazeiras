import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VALOR_CONVIDADO } from "@/lib/mercadopago.server";
import {
  cobrancaDoMetodo,
  cobrarNoCartao,
  dadosCalculados,
  dadosDoPix,
  metodoPagamento,
} from "@/lib/cobranca.server";
import type { DadosCobranca, MetodoPagamento } from "@/lib/taxasPagamento";

export interface PixConvite {
  pago: boolean;
  status: string;
  qrCode: string | null;
  qrBase64: string | null;
  valor: number;
  /** Forma de pagamento da última cobrança criada. */
  metodo?: MetodoPagamento;
  /** Link do checkout do Mercado Pago (só cartão de crédito/débito). */
  checkoutUrl?: string | null;
  expiraEm?: string | null;
  valorBase?: number;
  taxa?: number;
  taxaPercentual?: number;
}

/** Cobrança de convidado recém-criada, pronta para o diálogo de pagamento. */
export type CobrancaConvidado = DadosCobranca & {
  presencaId: string;
  pago: boolean;
  status: string;
};

/**
 * Cria a cobrança (PIX ou cartão) da diária de um convidado e guarda o estado
 * em `presencas` / `presencas_pagamento`. O valor cobrado é o valor base da
 * presença + a taxa da forma de pagamento (arredondada para cima).
 */
async function criarCobrancaPresenca(opts: {
  presencaId: string;
  valorBase: number;
  nomeConvidado: string;
  email: string;
  nomePagador: string;
  metodo: MetodoPagamento;
}): Promise<DadosCobranca> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { criarPagamentoPix } = await import("@/lib/mercadopago.server");
  const cobranca = await cobrancaDoMetodo(opts.valorBase, opts.metodo);
  const externalReference = `convidado:${opts.presencaId}`;
  const descricao = `Diária de convidado — ${opts.nomeConvidado}`;

  if (opts.metodo !== "pix") {
    const dados = await cobrarNoCartao({
      metodo: opts.metodo,
      cobranca,
      descricao,
      email: opts.email,
      externalReference,
      retorno: "/baba",
      idempotencyKey: `convidado-${opts.presencaId}-${opts.metodo}-${Date.now()}`,
    });
    await supabaseAdmin
      .from("presencas")
      .update({ mp_status: "pending" })
      .eq("id", opts.presencaId);
    await supabaseAdmin.from("presencas_pagamento").upsert(
      {
        presenca_id: opts.presencaId,
        pix_qr_code: null,
        pix_qr_base64: null,
        pix_expira_em: null,
      },
      { onConflict: "presenca_id" },
    );
    return dados;
  }

  const pix = await criarPagamentoPix({
    valor: cobranca.total,
    descricao,
    email: opts.email,
    nome: opts.nomePagador,
    externalReference,
    idempotencyKey: `convidado-${opts.presencaId}-${Date.now()}`,
  });
  await supabaseAdmin.from("presencas").update({ mp_status: pix.status }).eq("id", opts.presencaId);
  await supabaseAdmin.from("presencas_pagamento").upsert(
    {
      presenca_id: opts.presencaId,
      mp_payment_id: pix.paymentId,
      pix_qr_code: pix.qrCode,
      pix_qr_base64: pix.qrBase64,
      pix_expira_em: pix.expiraEm,
    },
    { onConflict: "presenca_id" },
  );
  return dadosDoPix(pix, cobranca);
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
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("solicita_convite", {
      _baba_id: data.babaId,
      _anfitriao_id: data.anfitriaoId,
    });
    if (error) throw new Error(error.message);
    return { solicitacaoId: id as string };
  });

/** Associado aceita ou recusa. Ao aceitar, cria a presença de convidado e gera o PIX. */
export const responderSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ solicitacaoId: z.string().uuid(), aceitar: z.boolean() }).parse(d),
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

    // Convidado "da casa"? (já aprovado pela diretoria em algum momento)
    const { data: cad } = await supabaseAdmin
      .from("convidados_cadastro")
      .select("id, nome, telefone, aprovado, bloqueado")
      .eq("user_id", sol.solicitante_id)
      .maybeSingle();
    if (cad?.bloqueado) throw new Error("Esse convidado está bloqueado pela diretoria");
    const daCasa = !!cad?.aprovado;

    if (!daCasa) {
      // Convidado NOVO: o anfitrião aceitou, mas a diretoria precisa aprovar antes de qualquer PIX.
      let convidadoId = cad?.id ?? null;
      if (!convidadoId) {
        const tel = perfilSolicitante?.telefone ?? "";
        const { data: porTel } = await supabaseAdmin
          .from("convidados_cadastro")
          .select("id, bloqueado")
          .eq("telefone", tel)
          .maybeSingle();
        if (porTel?.bloqueado) throw new Error("Esse convidado está bloqueado pela diretoria");
        convidadoId = porTel?.id ?? null;
      }
      if (!convidadoId) {
        const { data: novo, error: erroCad } = await supabaseAdmin
          .from("convidados_cadastro")
          .insert({
            nome: perfilSolicitante?.nome ?? "Convidado",
            telefone: perfilSolicitante?.telefone ?? "",
            criado_por: userId,
            user_id: sol.solicitante_id,
          })
          .select("id")
          .single();
        if (erroCad) throw erroCad;
        convidadoId = novo.id;
      }

      const { data: outroPedido } = await supabaseAdmin
        .from("pedidos_convidado")
        .select("id")
        .eq("baba_id", sol.baba_id)
        .eq("anfitriao_id", userId)
        .neq("status", "rejeitado")
        .maybeSingle();
      if (outroPedido) throw new Error("Você já tem um convidado nesse baba");

      const { data: pedido, error: erroPedido } = await supabaseAdmin
        .from("pedidos_convidado")
        .insert({
          baba_id: sol.baba_id,
          anfitriao_id: userId,
          convidado_id: convidadoId,
          solicitacao_id: sol.id,
          status: "pendente",
        })
        .select("id")
        .single();
      if (erroPedido) throw erroPedido;

      await supabase.from("solicitacoes_convidado").update({ status: "aprovado" }).eq("id", sol.id);

      // Avisa a diretoria (fila de aprovações em AprovacoesConvidados).
      const { data: admins } = await supabaseAdmin
        .from("papeis_usuario")
        .select("user_id")
        .eq("papel", "administrador");
      const msg = `${perfilSolicitante?.nome ?? "Um convidado"} pediu para entrar no baba e aguarda a aprovação da diretoria.`;
      for (const a of admins ?? []) {
        await supabaseAdmin.from("notificacoes").insert({
          usuario_id: a.user_id,
          titulo: "Novo convidado aguardando aprovação",
          mensagem: msg,
          link: "/admin/usuarios",
        });
      }

      return { aceito: true, aguardandoDiretoria: true, pedidoId: pedido.id };
    }

    // ---- Convidado da casa: libera presença + PIX direto (já foi aprovado pela diretoria). ----
    const { criarPagamentoPix, emailPagador, valorConvidadoAtual } =
      await import("@/lib/mercadopago.server");
    const valorConvidado = await valorConvidadoAtual();

    const { data: presenca, error: erroPresenca } = await supabase
      .from("presencas")
      .insert({
        baba_id: sol.baba_id,
        usuario_id: userId,
        nome_convidado: perfilSolicitante?.nome ?? "Convidado",
        convidado_user_id: sol.solicitante_id,
        status_convidado: "pendente",
        valor: valorConvidado,
      })
      .select("id")
      .single();
    if (erroPresenca) throw erroPresenca;

    if (perfilSolicitante?.telefone) {
      await supabaseAdmin
        .from("presencas_contato")
        .upsert(
          { presenca_id: presenca.id, telefone: perfilSolicitante.telefone },
          { onConflict: "presenca_id" },
        );
    }

    // Cobrança automática em PIX ao liberar a vaga (o convidado pode trocar
    // para cartão depois, pelo diálogo de pagamento).
    const cobranca = await cobrancaDoMetodo(valorConvidado, "pix");
    const pix = await criarPagamentoPix({
      valor: cobranca.total,
      descricao: `Taxa de convidado — ${perfilSolicitante?.nome ?? "Convidado"}`,
      email: emailPagador(perfilSolicitante?.telefone, sol.solicitante_id),
      nome: perfilSolicitante?.nome ?? "Convidado",
      externalReference: `convidado:${presenca.id}`,
      idempotencyKey: `convidado-${presenca.id}-${Date.now()}`,
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

/** Status de uma presença de convidado — confirma na API do Mercado Pago. */
async function statusDaPresenca(presencaId: string): Promise<PixConvite> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: presenca } = await supabaseAdmin
    .from("presencas")
    .select("id, status_convidado, valor")
    .eq("id", presencaId)
    .maybeSingle();
  if (!presenca) throw new Error("Cobrança não encontrada");

  const { data: cobranca } = await supabaseAdmin
    .from("presencas_pagamento")
    .select("pix_qr_code, pix_qr_base64")
    .eq("presenca_id", presenca.id)
    .maybeSingle();

  const base = {
    qrCode: cobranca?.pix_qr_code ?? null,
    qrBase64: cobranca?.pix_qr_base64 ?? null,
    valor: Number(presenca.valor) > 0 ? Number(presenca.valor) : VALOR_CONVIDADO,
  };

  if (presenca.status_convidado === "aprovado") return { pago: true, status: "approved", ...base };

  // Confirma na API do Mercado Pago (PIX ou cartão) e aplica no banco.
  const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
  const resultado = await sincronizarPorReferencia(`convidado:${presenca.id}`);
  return { pago: resultado.pago, status: resultado.status, ...base };
}

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

    // Fluxo novo (roteado pela diretoria): a solicitação não tem presença própria;
    // o PIX nasce do pedido aprovado pelo admin.
    if (!sol.presenca_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: pedido } = await supabaseAdmin
        .from("pedidos_convidado")
        .select("id, status, presenca_id")
        .eq("solicitacao_id", sol.id)
        .maybeSingle();
      if (!pedido)
        return {
          pago: false,
          status: "sem_cobranca",
          qrCode: null,
          qrBase64: null,
          valor: VALOR_CONVIDADO,
        };
      if (pedido.status === "pendente") {
        return {
          pago: false,
          status: "aguardando_diretoria",
          qrCode: null,
          qrBase64: null,
          valor: VALOR_CONVIDADO,
        };
      }
      if (pedido.presenca_id) return await statusDaPresenca(pedido.presenca_id);
      return {
        pago: false,
        status: "sem_cobranca",
        qrCode: null,
        qrBase64: null,
        valor: VALOR_CONVIDADO,
      };
    }

    return await statusDaPresenca(sol.presenca_id);
  });

/* ===================== Novo fluxo de convidados ===================== */

export interface PedidoConvidadoResultado {
  pedidoId: string;
  status: "pendente" | "aprovado" | "rejeitado";
  convidadoId: string;
}

/** Cria o pedido: convidado novo entra como pendente; convidado da casa já nasce aprovado. */
export const criarPedidoConvidado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        babaId: z.string().uuid(),
        nome: z.string().trim().max(80).optional(),
        telefone: z.string().trim().max(30).optional(),
        convidadoId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PedidoConvidadoResultado> => {
    const { supabase } = context;
    const { data: linhas, error } = await supabase.rpc("criar_pedido_convidado", {
      _baba_id: data.babaId,
      _nome: data.nome ?? "",
      _telefone: data.telefone ?? "",
      _convidado_id: data.convidadoId ?? undefined,
    });
    if (error) throw new Error(error.message);
    const linha = Array.isArray(linhas) ? linhas[0] : linhas;
    if (!linha) throw new Error("Não foi possível criar o pedido");
    return {
      pedidoId: linha.pedido_id as string,
      status: linha.status as PedidoConvidadoResultado["status"],
      convidadoId: linha.convidado_id as string,
    };
  });

/** Diretoria aprova ou recusa um pedido de convidado novo. */
export const decidirPedidoConvidado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pedidoId: z.string().uuid(), aprovar: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decidir_pedido_convidado", {
      _pedido_id: data.pedidoId,
      _aprovar: data.aprovar,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Gera a cobrança (PIX ou cartão) da diária do convidado — só depois do pedido aprovado. */
export const gerarPixPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pedidoId: z.string().uuid(), metodo: metodoPagamento }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CobrancaConvidado> => {
    const { supabase, userId } = context;
    const { data: pedido } = await supabase
      .from("pedidos_convidado")
      .select("id, baba_id, anfitriao_id, convidado_id, status, presenca_id")
      .eq("id", data.pedidoId)
      .maybeSingle();
    if (!pedido || pedido.anfitriao_id !== userId) throw new Error("Pedido não encontrado");
    if (pedido.status !== "aprovado")
      throw new Error("Esse convidado ainda aguarda a aprovação da diretoria");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cad } = await supabaseAdmin
      .from("convidados_cadastro")
      .select("id, nome, telefone, user_id, bloqueado")
      .eq("id", pedido.convidado_id)
      .maybeSingle();
    if (!cad) throw new Error("Convidado não encontrado");
    if (cad.bloqueado) throw new Error("Esse convidado está bloqueado pela diretoria");

    let presencaId = pedido.presenca_id;
    if (!presencaId) {
      const { criarPagamentoPix, emailPagador, valorConvidadoAtual } =
        await import("@/lib/mercadopago.server");
      const valorConvidado = await valorConvidadoAtual();

      const { data: presenca, error: erroPresenca } = await supabase
        .from("presencas")
        .insert({
          baba_id: pedido.baba_id,
          usuario_id: userId,
          nome_convidado: cad.nome,
          convidado_cadastro_id: cad.id,
          convidado_user_id: cad.user_id,
          status_convidado: "pendente",
          valor: valorConvidado,
        })
        .select("id")
        .single();
      if (erroPresenca) throw erroPresenca;
      presencaId = presenca.id;
      await supabaseAdmin
        .from("pedidos_convidado")
        .update({ presenca_id: presencaId })
        .eq("id", pedido.id);
      await supabaseAdmin
        .from("presencas_contato")
        .upsert({ presenca_id: presencaId, telefone: cad.telefone }, { onConflict: "presenca_id" });
    }

    const { data: presencaAtual } = await supabaseAdmin
      .from("presencas")
      .select("status_convidado, valor")
      .eq("id", presencaId)
      .maybeSingle();

    const valorBase =
      Number(presencaAtual?.valor) > 0 ? Number(presencaAtual?.valor) : VALOR_CONVIDADO;

    const valorCobrado = await cobrancaDoMetodo(valorBase, data.metodo);

    if (presencaAtual?.status_convidado === "aprovado") {
      return {
        ...dadosCalculados(valorCobrado, data.metodo),
        presencaId,
        pago: true,
        status: "approved",
      };
    }

    const { data: anfitriao } = await supabaseAdmin
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { emailPagador } = await import("@/lib/mercadopago.server");
    const dados = await criarCobrancaPresenca({
      presencaId,
      valorBase,
      nomeConvidado: cad.nome,
      email: emailPagador(anfitriao?.telefone, userId),
      nomePagador: anfitriao?.nome ?? "Associado",
      metodo: data.metodo,
    });

    return {
      ...dados,
      presencaId,
      pago: false,
      status: "pending",
    };
  });

/** Status de pagamento do pedido (somente leitura) — usado no polling do anfitrião. */
export const statusPagamentoPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pedidoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ pago: boolean; status: string }> => {
    const { supabase, userId } = context;
    const { data: pedido } = await supabase
      .from("pedidos_convidado")
      .select("id, anfitriao_id, presenca_id")
      .eq("id", data.pedidoId)
      .maybeSingle();
    if (!pedido || pedido.anfitriao_id !== userId) throw new Error("Pedido não encontrado");
    if (!pedido.presenca_id) return { pago: false, status: "sem_cobranca" };

    const { sincronizarPorReferencia } = await import("@/lib/pagamentos.server");
    return await sincronizarPorReferencia(`convidado:${pedido.presenca_id}`);
  });

/**
 * Gera a cobrança da diária do convidado (PIX ou cartão) para o convidado pagar
 * — liberado ao solicitante e ao anfitrião, depois que a vaga existe.
 */
export const gerarCobrancaSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ solicitacaoId: z.string().uuid(), metodo: metodoPagamento }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CobrancaConvidado> => {
    const { supabase, userId } = context;
    const { data: sol } = await supabase
      .from("solicitacoes_convidado")
      .select("id, solicitante_id, anfitriao_id, presenca_id")
      .eq("id", data.solicitacaoId)
      .maybeSingle();
    if (!sol || (sol.solicitante_id !== userId && sol.anfitriao_id !== userId)) {
      throw new Error("Solicitação não encontrada");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let presencaId = sol.presenca_id;
    if (!presencaId) {
      const { data: pedido } = await supabaseAdmin
        .from("pedidos_convidado")
        .select("id, presenca_id")
        .eq("solicitacao_id", sol.id)
        .maybeSingle();
      presencaId = pedido?.presenca_id ?? null;
    }
    if (!presencaId) throw new Error("Aguarde o associado liberar a vaga do convidado");

    const { data: presenca } = await supabaseAdmin
      .from("presencas")
      .select("id, status_convidado, valor, nome_convidado")
      .eq("id", presencaId)
      .maybeSingle();
    if (!presenca) throw new Error("Cobrança não encontrada");

    const valorBase = Number(presenca.valor) > 0 ? Number(presenca.valor) : VALOR_CONVIDADO;
    const valorCobrado = await cobrancaDoMetodo(valorBase, data.metodo);
    if (presenca.status_convidado === "aprovado") {
      return {
        ...dadosCalculados(valorCobrado, data.metodo),
        presencaId,
        pago: true,
        status: "approved",
      };
    }

    const { data: perfil } = await supabaseAdmin
      .from("perfis")
      .select("nome, telefone")
      .eq("id", userId)
      .maybeSingle();

    const { emailPagador } = await import("@/lib/mercadopago.server");
    const dados = await criarCobrancaPresenca({
      presencaId,
      valorBase,
      nomeConvidado: presenca.nome_convidado ?? "Convidado",
      email: emailPagador(perfil?.telefone, userId),
      nomePagador: perfil?.nome ?? "Associado",
      metodo: data.metodo,
    });

    return { ...dados, presencaId, pago: false, status: "pending" };
  });
