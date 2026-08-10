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
          "administrador" | "associado" | "convidado",
        rotuloPapel: isAdmin ? "Diretoria" : isConvidado ? "Convidado" : "Associado",
      };
    },
  });

export const proximaSessaoQuery = () =>
  queryOptions({
    queryKey: ["proxima-sessao"],
    queryFn: async () => {
      // Janela: o baba "atual" continua visível até 1h após o início (check-in GPS segue aberto).
      const inicioJanela = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .gte("data_horario", inicioJanela)
        .order("data_horario", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/** Próximos babas (a partir da janela atual) em ordem crescente. */
export const proximasSessoesQuery = () =>
  queryOptions({
    queryKey: ["sessoes-proximas"],
    queryFn: async () => {
      const inicioJanela = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .gte("data_horario", inicioJanela)
        .order("data_horario", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Babas passados (fora da janela de check-in) em ordem decrescente. */
export const sessoesPassadasQuery = () =>
  queryOptions({
    queryKey: ["sessoes-passadas"],
    queryFn: async () => {
      const inicioJanela = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .lt("data_horario", inicioJanela)
        .order("data_horario", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
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
          "id, baba_id, usuario_id, nome_convidado, convidado_user_id, status_convidado, confirmado_em, mp_status, valor, chegou_em, ordem_chegada, compareceu, is_goleiro_fixo",
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

/** Locais fixos de baba (endereços reutilizáveis). */
export const locaisBabaQuery = () =>
  queryOptions({
    queryKey: ["locais-baba"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locais_baba")
        .select("*")
        .order("nome", { ascending: true });
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

/**
 * Mural de punições: mostra apenas suspensões ATIVAS — ou seja, cujo baba
 * bloqueado ainda não aconteceu. Quando a suspensão termina (o baba passa),
 * o nome sai do mural automaticamente, sem expor o jogador por mais tempo.
 */
export const suspensoesQuery = () =>
  queryOptions({
    queryKey: ["suspensoes"],
    queryFn: async () => {
      const agora = Date.now();
      const { data, error } = await supabase
        .from("suspensoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;

      // Babas bloqueados ainda no futuro = suspensões em vigor.
      const idsBabas = Array.from(
        new Set((data ?? []).map((s) => s.baba_bloqueado_id).filter((id): id is string => !!id)),
      );
      const futuros = new Set<string>();
      if (idsBabas.length > 0) {
        const { data: babas } = await supabase
          .from("sessoes_baba")
          .select("id, data_horario")
          .in("id", idsBabas);
        for (const b of babas ?? []) {
          if (new Date(b.data_horario).getTime() > agora) futuros.add(b.id);
        }
      }
      const ativas = (data ?? []).filter((s) => futuros.has(s.baba_bloqueado_id ?? ""));

      const ids = Array.from(new Set(ativas.map((s) => s.usuario_id)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome")
          .in("id", ids);
        for (const p of perfis ?? []) nomes.set(p.id, p.nome);
      }
      return ativas.map((s) => ({ ...s, nome: nomes.get(s.usuario_id) ?? "Jogador" }));
    },
  });

/** Parâmetros da política de suspensões (ajustáveis pela diretoria em configuracoes). */
export const politicaSuspensaoQuery = () =>
  queryOptions({
    queryKey: ["politica-suspensao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", [
          "limite_faltas",
          "janela_faltas",
          "suspensao_faltas_babas",
          "suspensao_vermelho_babas",
        ]);
      if (error) throw error;
      const m = new Map((data ?? []).map((c) => [c.chave, Number(c.valor)]));
      return {
        limiteFaltas: m.get("limite_faltas") ?? 3,
        janelaFaltas: m.get("janela_faltas") ?? 5,
        suspensaoFaltasBabas: m.get("suspensao_faltas_babas") ?? 1,
        suspensaoVermelhoBabas: m.get("suspensao_vermelho_babas") ?? 1,
      };
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

/** Ajustes manuais de babas pagos de convidados (diretoria). */
export const ajustesBabasConvidadoQuery = () =>
  queryOptions({
    queryKey: ["ajustes-babas-convidado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ajustes_babas_convidado")
        .select("*")
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
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

/** Valores padrão usados quando a configuração ainda não existe (espelha o servidor). */
export const VALOR_MENSALIDADE_PADRAO = 15;
export const VALOR_CONVIDADO_PADRAO = 5;

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
              .limit(1)
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
      return Number(data?.valor ?? VALOR_MENSALIDADE_PADRAO);
    },
  });

/** Valor atual da diária de convidado definido pela diretoria. */
export const valorConvidadoQuery = () =>
  queryOptions({
    queryKey: ["valor-convidado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "valor_convidado")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.valor ?? VALOR_CONVIDADO_PADRAO);
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

/**
 * Nomes dos convidados por id. Busca direta (colunas liberadas ao associado);
 * o join embutido do PostgREST não é permitido nessa tabela.
 */
async function nomesConvidados(ids: string[]) {
  const mapa = new Map<string, { id: string; nome: string }>();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return mapa;
  const { data, error } = await supabase
    .from("convidados_cadastro")
    .select("id, nome")
    .in("id", unicos);
  if (error) throw error;
  for (const c of data ?? []) mapa.set(c.id, c);
  return mapa;
}

/** Pedidos de convidado que eu (associado) fiz para um baba. */
export const meusPedidosConvidadoQuery = (userId: string | undefined, babaId: string | undefined) =>
  queryOptions({
    queryKey: ["pedidos-convidado-meus", userId, babaId],
    enabled: !!userId && !!babaId,
    queryFn: async () => {
      if (!userId || !babaId) return [];
      const { data, error } = await supabase
        .from("pedidos_convidado")
        .select("id, status, presenca_id, criado_em, convidado_id")
        .eq("anfitriao_id", userId)
        .eq("baba_id", babaId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      const mapa = await nomesConvidados((data ?? []).map((p) => p.convidado_id));
      return (data ?? []).map((p) => ({
        ...p,
        convidados_cadastro: mapa.get(p.convidado_id) ?? null,
      }));
    },
  });

/** Pedidos de convidado aguardando decisão da diretoria. */
export const pedidosConvidadoPendentesQuery = () =>
  queryOptions({
    queryKey: ["pedidos-convidado-pendentes"],
    queryFn: async () => {
      const { data: brutos, error } = await supabase
        .from("pedidos_convidado")
        .select("id, status, criado_em, baba_id, anfitriao_id, convidado_id")
        .eq("status", "pendente")
        .order("criado_em", { ascending: false });
      if (error) throw error;

      const mapa = await nomesConvidados((brutos ?? []).map((p) => p.convidado_id));
      const data = (brutos ?? []).map((p) => ({
        ...p,
        convidados_cadastro: mapa.get(p.convidado_id) ?? null,
      }));

      const ids = Array.from(new Set((data ?? []).map((p) => p.anfitriao_id)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis_publicos")
          .select("id, nome")
          .in("id", ids);
        for (const p of perfis ?? []) nomes.set(p.id, p.nome);
      }

      // O telefone só é liberado pelo banco para a diretoria / quem cadastrou.
      const telefones = await Promise.all(
        (data ?? []).map(async (p) => {
          const id = p.convidados_cadastro?.id;
          if (!id) return null;
          const { data: tel } = await supabase.rpc("telefone_convidado", { _convidado_id: id });
          return tel ?? null;
        }),
      );

      return (data ?? []).map((p, i) => ({
        ...p,
        telefoneConvidado: telefones[i],
        nomeAnfitriao: nomes.get(p.anfitriao_id) ?? "Associado",
      }));
    },
  });

// ==================== GAMIFICAÇÃO: conquistas ====================

/** Catálogo completo de conquistas do sistema, ordenado por categoria e meta. */
export const conquistasQuery = () =>
  queryOptions({
    queryKey: ["conquistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conquistas")
        .select("*")
        .order("categoria", { ascending: true })
        .order("meta", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Conquistas desbloqueadas por um usuário (com detalhes da conquista). */
export const minhasConquistasQuery = (usuarioId: string | undefined) =>
  queryOptions({
    queryKey: ["minhas-conquistas", usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      if (!usuarioId) return [];
      const { data, error } = await supabase
        .from("usuario_conquistas")
        .select(
          "id, usuario_id, conquista_id, desbloqueada_em, em_destaque, ordem_destaque, conquistas(id, codigo, nome, descricao, icone, cor, categoria, meta)",
        )
        .eq("usuario_id", usuarioId);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Conquista em destaque exibida nas micro-badges. */
export interface ConquistaDestaque {
  id: string;
  codigo: string;
  nome: string;
  icone: string;
  cor: string;
}

/** Conquistas em destaque de todos os usuários (para micro-badges globais). */
export const conquistasEmDestaqueQuery = () =>
  queryOptions({
    queryKey: ["conquistas-em-destaque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuario_conquistas")
        .select("usuario_id, ordem_destaque, conquistas(id, codigo, nome, icone, cor)")
        .eq("em_destaque", true)
        .order("ordem_destaque", { ascending: true });
      if (error) throw error;

      const mapa = new Map<string, ConquistaDestaque[]>();
      for (const uc of data ?? []) {
        const c = uc.conquistas as ConquistaDestaque | ConquistaDestaque[] | null;
        if (!c) continue;
        const itens = Array.isArray(c) ? c : [c];
        const lista = mapa.get(uc.usuario_id) ?? [];
        lista.push(...itens);
        mapa.set(uc.usuario_id, lista);
      }
      return mapa;
    },
  });

// ==================== CARTINHAS DE JOGADOR ====================

/** Campos do perfil usados para montar a cartinha de um jogador. */
export const CAMPOS_CARTINHA =
  "id, nome, avatar_url, posicao, nivel_atual, ovr, stat_ritmo, stat_finalizacao, stat_passe, stat_drible, stat_defesa, stat_fisico, tema_carta";

/** Dados de um jogador para exibir a cartinha (perfil + atributos calculados). */
export const cartinhaPerfilQuery = (usuarioId: string | undefined) =>
  queryOptions({
    queryKey: ["cartinha-perfil", usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      if (!usuarioId) return null;
      const { data, error } = await supabase
        .from("perfis")
        .select(
          "id, nome, avatar_url, posicao, nivel_atual, ovr, stat_ritmo, stat_finalizacao, stat_passe, stat_drible, stat_defesa, stat_fisico, tema_carta",
        )
        .eq("id", usuarioId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
