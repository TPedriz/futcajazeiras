import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const perfilAtualQuery = () =>
  queryOptions({
    queryKey: ["perfil-atual"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const [{ data: perfil }, { data: papeis }] = await Promise.all([
        supabase.from("perfis").select("*").eq("id", userData.user.id).maybeSingle(),
        supabase.from("papeis_usuario").select("papel").eq("user_id", userData.user.id),
      ]);

      const lista = (papeis ?? []).map((p) => p.papel);
      const isAdmin = lista.includes("administrador");
      const isConvidado = !isAdmin && !lista.includes("associado");
      return {
        user: userData.user,
        perfil,
        papeis: lista,
        isAdmin,
        isAssociado: isAdmin || lista.includes("associado"),
        isConvidado,
        papelPrincipal: (isAdmin ? "administrador" : isConvidado ? "convidado" : "associado") as
          | "administrador"
          | "associado"
          | "convidado",
        rotuloPapel: isAdmin ? "Diretoria" : isConvidado ? "Convidado" : "Associado",
      };
    },
  });

export const proximaSessaoQuery = () =>
  queryOptions({
    queryKey: ["proxima-sessao"],
    queryFn: async () => {
      const agora = new Date().toISOString();
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .gte("data_horario", agora)
        .order("data_horario", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const presencasDaSessaoQuery = (babaId: string | undefined) =>
  queryOptions({
    queryKey: ["presencas", babaId],
    enabled: !!babaId,
    queryFn: async () => {
      if (!babaId) return [];
      const { data: presencas, error } = await supabase
        .from("presencas")
        .select(
          "id, baba_id, usuario_id, nome_convidado, convidado_user_id, status_convidado, confirmado_em, mp_status, valor, chegou_em, ordem_chegada, compareceu",
        )
        .eq("baba_id", babaId)
        .order("confirmado_em", { ascending: true });
      if (error) throw error;

      const ids = Array.from(
        new Set((presencas ?? []).map((p) => p.usuario_id).filter(Boolean)),
      ) as string[];
      const mapa = new Map<
        string,
        {
          id: string;
          nome: string;
          posicao: "linha" | "goleiro";
          time_coracao: "bahia" | "vitoria" | null;
          avatar_url: string | null;
        }
      >();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome, posicao, time_coracao, avatar_url")
          .in("id", ids);
        for (const p of perfis ?? []) mapa.set(p.id, p);
      }

      return (presencas ?? []).map((p) => ({
        ...p,
        perfis: p.usuario_id ? (mapa.get(p.usuario_id) ?? null) : null,
      }));
    },
  });

export const todasSessoesQuery = () =>
  queryOptions({
    queryKey: ["sessoes-todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .order("data_horario", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

export const todosAssociadosQuery = () =>
  queryOptions({
    queryKey: ["associados-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const mesReferencia = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export const minhasMensalidadesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["mensalidades-minhas", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      await supabase.rpc("garante_mensalidades_mes");
      const { data, error } = await supabase
        .from("mensalidades")
        .select("*")
        .eq("usuario_id", userId)
        .order("referencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const mensalidadesDoMesQuery = (referencia: string) =>
  queryOptions({
    queryKey: ["mensalidades-mes", referencia],
    queryFn: async () => {
      await supabase.rpc("garante_mensalidades_mes");
      const { data, error } = await supabase
        .from("mensalidades")
        .select("*")
        .eq("referencia", referencia);
      if (error) throw error;
      return data ?? [];
    },
  });

export const rankingDoMesQuery = (referencia: string) =>
  queryOptions({
    queryKey: ["ranking-mes", referencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ranking_mensal")
        .select("*")
        .eq("mes", referencia);
      if (error) throw error;
      return data ?? [];
    },
  });

export const papeisTodosQuery = () =>
  queryOptions({
    queryKey: ["papeis-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("papeis_usuario").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

export const timesDoBabaQuery = (babaId: string | undefined) =>
  queryOptions({
    queryKey: ["times-baba", babaId],
    enabled: !!babaId,
    queryFn: async () => {
      if (!babaId) return [];
      const { data, error } = await supabase
        .from("times_baba")
        .select(
          "id, baba_id, nome, resultado, times_jogadores(id, usuario_id, nome_convidado, posicao)",
        )
        .eq("baba_id", babaId)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const estatisticasDoBabaQuery = (babaId: string | undefined) =>
  queryOptions({
    queryKey: ["estatisticas-baba", babaId],
    enabled: !!babaId,
    queryFn: async () => {
      if (!babaId) return [];
      const { data, error } = await supabase
        .from("estatisticas_baba")
        .select("*")
        .eq("baba_id", babaId);
      if (error) throw error;
      return data ?? [];
    },
  });

export const perfisPublicosQuery = () =>
  queryOptions({
    queryKey: ["perfis-publicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_publicos")
        .select("id, nome, posicao, avatar_url")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const minhasSolicitacoesQuery = (userId: string | undefined, babaId: string | undefined) =>
  queryOptions({
    queryKey: ["solicitacoes-minhas", userId, babaId],
    enabled: !!userId && !!babaId,
    queryFn: async () => {
      if (!userId || !babaId) return [];
      const { data, error } = await supabase
        .from("solicitacoes_convidado")
        .select("*")
        .eq("solicitante_id", userId)
        .eq("baba_id", babaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const solicitacoesRecebidasQuery = (
  userId: string | undefined,
  babaId: string | undefined,
) =>
  queryOptions({
    queryKey: ["solicitacoes-recebidas", userId, babaId],
    enabled: !!userId && !!babaId,
    queryFn: async () => {
      if (!userId || !babaId) return [];
      const { data, error } = await supabase
        .from("solicitacoes_convidado")
        .select("*")
        .eq("anfitriao_id", userId)
        .eq("baba_id", babaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((data ?? []).map((s) => s.solicitante_id)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome")
          .in("id", ids);
        for (const p of perfis ?? []) nomes.set(p.id, p.nome);
      }
      return (data ?? []).map((s) => ({
        ...s,
        nomeSolicitante: nomes.get(s.solicitante_id) ?? "Convidado",
      }));
    },
  });

/** Notificações do usuário logado, mais recentes primeiro. */
export const notificacoesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["notificacoes", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Mural de punições: suspensões ativas e recentes. */
export const suspensoesQuery = () =>
  queryOptions({
    queryKey: ["suspensoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suspensoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) throw error;

      const ids = Array.from(new Set((data ?? []).map((s) => s.usuario_id)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome")
          .in("id", ids);
        for (const p of perfis ?? []) nomes.set(p.id, p.nome);
      }
      return (data ?? []).map((s) => ({ ...s, nome: nomes.get(s.usuario_id) ?? "Jogador" }));
    },
  });

/** Meta de babas pagos que o convidado precisa cumprir para pedir associação. */
export const META_CONVIDADO = 3;

/** Limite global de associados ativos. */
export const LIMITE_ASSOCIADOS = 50;

/**
 * Quantos babas o convidado já jogou COM PAGAMENTO CONFIRMADO.
 * Só conta presença de convidado aprovada (PIX pago) e ligada a ele.
 */
export const babasPagosConvidadoQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["babas-pagos-convidado", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return 0;
      const { data, error } = await supabase.rpc("babas_pagos_convidado", { _user_id: userId });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

/** Total de associados ativos (para o limite de 50 vagas). */
export const vagasAssociadosQuery = () =>
  queryOptions({
    queryKey: ["vagas-associados"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("total_associados_ativos");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

/** Minha solicitação de associação mais recente. */
export const minhaSolicitacaoAssociacaoQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["solicitacao-associacao", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("solicitacoes_associacao")
        .select("*")
        .eq("usuario_id", userId)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/** Solicitações de associação pendentes (diretoria). */
export const solicitacoesAssociacaoQuery = () =>
  queryOptions({
    queryKey: ["solicitacoes-associacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_associacao")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((data ?? []).map((s) => s.usuario_id)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome")
          .in("id", ids);
        for (const p of perfis ?? []) nomes.set(p.id, p.nome);
      }
      return (data ?? []).map((s) => ({ ...s, nome: nomes.get(s.usuario_id) ?? "Convidado" }));
    },
  });

/** Dia fixo de vencimento da mensalidade. */
export const DIA_VENCIMENTO = 10;

/** Situação do jogador para o check-in: inadimplência e suspensão. */
export const situacaoCheckinQuery = (userId: string | undefined, babaId: string | undefined) =>
  queryOptions({
    queryKey: ["situacao-checkin", userId, babaId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { inadimplente: false, suspenso: false, motivoSuspensao: "" };
      const referencia = mesReferencia();
      const [{ data: mensalidade }, { data: suspensao }] = await Promise.all([
        supabase
          .from("mensalidades")
          .select("status")
          .eq("usuario_id", userId)
          .eq("referencia", referencia)
          .maybeSingle(),
        babaId
          ? supabase
              .from("suspensoes")
              .select("motivo")
              .eq("usuario_id", userId)
              .eq("baba_bloqueado_id", babaId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const hoje = new Date();
      const passouVencimento = hoje.getDate() > DIA_VENCIMENTO;
      const pago = mensalidade?.status === "pago";

      return {
        inadimplente: passouVencimento && !pago,
        suspenso: !!suspensao,
        motivoSuspensao: suspensao?.motivo ?? "",
      };
    },
  });

/** Valor atual da mensalidade definido pela diretoria. */
export const valorMensalidadeQuery = () =>
  queryOptions({
    queryKey: ["valor-mensalidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "valor_mensalidade")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.valor ?? 20);
    },
  });

/** Fechamento padrão da lista: 3 horas antes do início do baba. */
export function fechamentoPadrao(dataHorario: Date) {
  return new Date(dataHorario.getTime() - 3 * 60 * 60 * 1000);
}

/** Data efetiva de fechamento (usa o padrão quando a diretoria não definiu). */
export function fechamentoEfetivo(sessao: {
  data_horario: string;
  fechamento_lista: string | null;
}) {
  return sessao.fechamento_lista
    ? new Date(sessao.fechamento_lista)
    : fechamentoPadrao(new Date(sessao.data_horario));
}

/**
 * Abertura padrão da lista: 22h do dia anterior ao baba, no fuso America/Bahia
 * (UTC-3 fixo, sem DST). Usa a data local do jogo em Salvador para o cálculo,
 * então o resultado é o mesmo instante independente do fuso do aparelho.
 */
export function aberturaPadrao(dataHorario: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dataHorario);
  const pega = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  // 22h do dia anterior em UTC-3 == 01h UTC do dia do jogo
  return new Date(Date.UTC(pega("year"), pega("month") - 1, pega("day"), 1, 0, 0));
}

/** Data efetiva de abertura (usa o padrão quando a diretoria não definiu). */
export function aberturaEfetivo(sessao: { data_horario: string; abertura_lista: string | null }) {
  return sessao.abertura_lista
    ? new Date(sessao.abertura_lista)
    : aberturaPadrao(new Date(sessao.data_horario));
}

/** Convidados "da casa": já aprovados pela diretoria e sem bloqueio. */
export const convidadosDaCasaQuery = () =>
  queryOptions({
    queryKey: ["convidados-da-casa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convidados_cadastro")
        .select("id, nome, aprovado, bloqueado")
        .eq("aprovado", true)
        .eq("bloqueado", false)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Pedidos de convidado que eu (associado) fiz para um baba. */
export const meusPedidosConvidadoQuery = (userId: string | undefined, babaId: string | undefined) =>
  queryOptions({
    queryKey: ["pedidos-convidado-meus", userId, babaId],
    enabled: !!userId && !!babaId,
    queryFn: async () => {
      if (!userId || !babaId) return [];
      const { data, error } = await supabase
        .from("pedidos_convidado")
        .select("id, status, presenca_id, criado_em, convidados_cadastro(id, nome)")
        .eq("anfitriao_id", userId)
        .eq("baba_id", babaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Pedidos de convidado aguardando decisão da diretoria. */
export const pedidosConvidadoPendentesQuery = () =>
  queryOptions({
    queryKey: ["pedidos-convidado-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_convidado")
        .select(
          "id, status, criado_em, baba_id, anfitriao_id, convidados_cadastro(id, nome, telefone)",
        )
        .eq("status", "pendente")
        .order("criado_em", { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((data ?? []).map((p) => p.anfitriao_id)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome")
          .in("id", ids);
        for (const p of perfis ?? []) nomes.set(p.id, p.nome);
      }
      return (data ?? []).map((p) => ({
        ...p,
        nomeAnfitriao: nomes.get(p.anfitriao_id) ?? "Associado",
      }));
    },
  });
