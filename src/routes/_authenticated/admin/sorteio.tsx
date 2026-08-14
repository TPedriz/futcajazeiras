import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  proximaSessaoQuery,
  presencasDaSessaoQuery,
  todosAssociadosQuery,
  baviRelacionadosQuery,
} from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  sortearTimes,
  sortearPrimeiroChegada,
  substituirJogador,
  idsAlocados,
  formatarTimesParaWhatsApp,
  TAMANHOS_TIME,
  type JogadorSorteio,
  type TimeSorteado,
  type SorteioEstado,
} from "@/lib/sorteio";
import { useState, useMemo, useEffect } from "react";
import {
  Shuffle,
  Copy,
  HandMetal,
  User,
  Save,
  Lock,
  ArrowLeftRight,
  Check,
  Heart,
  Users,
} from "lucide-react";
import { MicroConquistas } from "@/components/MicroConquistas";
import { NomeJogadorCartinha } from "@/components/NomeJogadorCartinha";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/sorteio")({
  loader: ({ context }) => context.queryClient.ensureQueryData(proximaSessaoQuery()),
  component: SorteioPage,
});

function SorteioPage() {
  const { data: sessao } = useSuspenseQuery(proximaSessaoQuery());
  const { data: presencas } = useQuery(presencasDaSessaoQuery(sessao?.id));
  const [resultado, setResultado] = useState<{
    times: TimeSorteado[];
    sobras: JogadorSorteio[];
  } | null>(null);
  const [estadoChegada, setEstadoChegada] = useState<SorteioEstado | null>(null);
  const [tamanho, setTamanho] = useState<number>(7);
  const [modo, setModo] = useState<"aleatorio" | "chegada" | "baxvi">(
    sessao?.tipo === "baxvi" ? "baxvi" : "aleatorio",
  );
  const [substituindoId, setSubstituindoId] = useState<string | null>(null);
  const [substitutoId, setSubstitutoId] = useState<string>("");
  const [relacionados, setRelacionados] = useState<Record<string, "bahia" | "vitoria">>({});

  const qc = useQueryClient();

  const { data: todos } = useQuery(todosAssociadosQuery());
  const { data: relacionadosSalvos } = useQuery(
    baviRelacionadosQuery(sessao?.tipo === "baxvi" ? sessao?.id : undefined),
  );

  // Carrega a escalação já salva quando a tela abre (ou após salvar).
  useEffect(() => {
    if (!relacionadosSalvos) return;
    const inicial: Record<string, "bahia" | "vitoria"> = {};
    for (const r of relacionadosSalvos) {
      if (r.time_nome === "bahia" || r.time_nome === "vitoria") inicial[r.usuario_id] = r.time_nome;
    }
    setRelacionados(inicial);
  }, [relacionadosSalvos]);

  /** Associados ativos elegíveis para o clássico (ordem alfabética). */
  const poolBavi = useMemo(
    () =>
      (todos ?? []).filter((u) => u.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)),
    [todos],
  );

  /**
   * Em cada coluna só aparecem os associados que torcem para o time (ou que
   * ainda não escolheram time) — evita escalar gente errada. Quem já foi
   * relacionado no time continua visível para poder ser desfeito.
   */
  const poolBahia = useMemo(
    () =>
      poolBavi.filter(
        (u) =>
          u.time_coracao === "bahia" || u.time_coracao == null || relacionados[u.id] === "bahia",
      ),
    [poolBavi, relacionados],
  );
  const poolVitoria = useMemo(
    () =>
      poolBavi.filter(
        (u) =>
          u.time_coracao === "vitoria" ||
          u.time_coracao == null ||
          relacionados[u.id] === "vitoria",
      ),
    [poolBavi, relacionados],
  );

  const selecionarRelacionado = (usuarioId: string, time: "bahia" | "vitoria") => {
    setRelacionados((r) => {
      const atual = r[usuarioId];
      if (atual === time) {
        const { [usuarioId]: _removido, ...resto } = r;
        return resto;
      }
      return { ...r, [usuarioId]: time };
    });
  };

  const autoPreencherPorCoracao = () => {
    const novo: Record<string, "bahia" | "vitoria"> = {};
    for (const u of poolBavi) {
      if (u.time_coracao === "bahia") novo[u.id] = "bahia";
      else if (u.time_coracao === "vitoria") novo[u.id] = "vitoria";
    }
    setRelacionados(novo);
    toast.success("Escalação sugerida pelo time do coração", {
      description: "Ajuste manualmente quem você quiser antes de salvar.",
    });
  };

  const salvarRelacionados = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sem sessão");
      const bahia = poolBavi.filter((u) => relacionados[u.id] === "bahia");
      const vitoria = poolBavi.filter((u) => relacionados[u.id] === "vitoria");
      if (bahia.length === 0 || vitoria.length === 0)
        throw new Error("Selecione pelo menos um jogador em cada time.");

      // 1. Salva a lista de relacionados (escalação).
      const { error: eDelRel } = await supabase
        .from("bavi_relacionados")
        .delete()
        .eq("baba_id", sessao.id);
      if (eDelRel) throw eDelRel;
      const rel = [
        ...bahia.map((u) => ({
          baba_id: sessao.id,
          usuario_id: u.id,
          time_nome: "bahia",
          posicao: u.posicao,
        })),
        ...vitoria.map((u) => ({
          baba_id: sessao.id,
          usuario_id: u.id,
          time_nome: "vitoria",
          posicao: u.posicao,
        })),
      ];
      const { error: eRel } = await supabase.from("bavi_relacionados").insert(rel);
      if (eRel) throw eRel;

      // 2. Salva os times (para resultados/estatísticas) a partir dos relacionados.
      await supabase.from("times_baba").delete().eq("baba_id", sessao.id);
      for (const [nome, jogadores] of [
        ["Time Bahia", bahia],
        ["Time Vitória", vitoria],
      ] as const) {
        const { data: time, error } = await supabase
          .from("times_baba")
          .insert({ baba_id: sessao.id, nome })
          .select("id")
          .single();
        if (error) throw error;
        const linhas = jogadores.map((j) => ({
          time_id: time.id,
          usuario_id: j.id,
          nome_convidado: null,
          posicao: j.posicao,
        }));
        if (linhas.length > 0) {
          const { error: e2 } = await supabase.from("times_jogadores").insert(linhas);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => {
      toast.success("Relacionados do BAxVI salvos!", {
        description: "Times prontos para lançar resultados e estatísticas.",
      });
      qc.invalidateQueries({ queryKey: ["bavi-relacionados", sessao?.id] });
      qc.invalidateQueries({ queryKey: ["times-baba", sessao?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar relacionados", { description: e.message }),
  });

  const copiarRelacionados = async () => {
    if (!sessao) return;
    const bahia = poolBavi.filter((u) => relacionados[u.id] === "bahia");
    const vitoria = poolBavi.filter((u) => relacionados[u.id] === "vitoria");
    const linhas: string[] = [];
    linhas.push("⚔️ *BAxVI — ESCALAÇÃO OFICIAL* ⚔️");
    linhas.push(
      `📅 ${format(new Date(sessao.data_horario), "dd/MM 'às' HH:mm", { locale: ptBR })}`,
    );
    linhas.push("");
    linhas.push(`� *Time Bahia* (${bahia.length})`);
    bahia.forEach((u) => linhas.push(`${u.posicao === "goleiro" ? "🧤 " : "• "}${u.nome}`));
    linhas.push("");
    linhas.push(`🔴 *Time Vitória* (${vitoria.length})`);
    vitoria.forEach((u) => linhas.push(`${u.posicao === "goleiro" ? "🧤 " : "• "}${u.nome}`));
    await navigator.clipboard.writeText(linhas.join("\n"));
    toast.success("Escalação copiada! Cole no grupo do WhatsApp.");
  };

  const toggleFixo = useMutation({
    mutationFn: async ({ id, fixo }: { id: string; fixo: boolean }) => {
      const { error } = await supabase
        .from("presencas")
        .update({ is_goleiro_fixo: fixo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presencas", sessao?.id] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const usuarioPorPresenca = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of presencas ?? []) m.set(p.id, p.nome_convidado ? null : p.usuario_id);
    return m;
  }, [presencas]);

  const salvarTimes = useMutation({
    mutationFn: async () => {
      const times = modo === "chegada" ? estadoChegada?.times : resultado?.times;
      if (!times || !sessao) throw new Error("Sorteie os times primeiro");
      await supabase.from("times_baba").delete().eq("baba_id", sessao.id);
      for (const t of times) {
        const { data: time, error } = await supabase
          .from("times_baba")
          .insert({ baba_id: sessao.id, nome: t.nome })
          .select("id")
          .single();
        if (error) throw error;
        const jogadoresTime = [...(t.goleiro ? [t.goleiro] : []), ...t.linha];
        const linhas = jogadoresTime.map((j) => ({
          time_id: time.id,
          usuario_id: usuarioPorPresenca.get(j.id) ?? null,
          nome_convidado: j.isConvidado ? j.nome : null,
          posicao: j.posicao,
        }));
        if (linhas.length > 0) {
          const { error: e2 } = await supabase.from("times_jogadores").insert(linhas);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => {
      toast.success("Times salvos!", {
        description: "Agora lance os resultados na aba Resultados.",
      });
      qc.invalidateQueries({ queryKey: ["times-baba", sessao?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const jogadores: JogadorSorteio[] = useMemo(() => {
    if (!presencas) return [];
    return presencas
      .filter((p) => !p.nome_convidado || p.status_convidado === "aprovado")
      .map((p) => ({
        id: p.id,
        nome: p.nome_convidado ?? p.perfis?.nome ?? "Jogador",
        posicao: (p.nome_convidado ? "linha" : (p.perfis?.posicao ?? "linha")) as
          | "goleiro"
          | "linha",
        isConvidado: !!p.nome_convidado,
        timeCoracao: p.perfis?.time_coracao ?? null,
        ordemChegada: p.ordem_chegada ?? null,
        chegouEm: p.chegou_em ?? null,
        isGoleiroFixo: p.nome_convidado ? false : (p.is_goleiro_fixo ?? false),
      }));
  }, [presencas]);

  // O sorteio (em qualquer modo) cobre a LISTA COMPLETA de presença confirmada.
  const elegiveis = jogadores;

  /** Goleiros com chegada confirmada — recebem o toggle "Fixo" antes do sorteio. */
  const goleirosChegados = useMemo(
    () =>
      (presencas ?? [])
        .filter(
          (p) => !p.nome_convidado && p.ordem_chegada != null && p.perfis?.posicao === "goleiro",
        )
        .map((p) => ({
          id: p.id,
          nome: p.perfis?.nome ?? "Goleiro",
          isGoleiroFixo: p.is_goleiro_fixo ?? false,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [presencas],
  );

  const etapa1Feita = !!estadoChegada;
  const timesAtuais = modo === "chegada" ? estadoChegada?.times : resultado?.times;
  const sobrasAtuais = modo === "chegada" ? [] : (resultado?.sobras ?? []);

  const previa = useMemo(() => {
    if (modo === "baxvi") return { times: 2, reservas: 0 };
    return { times: Math.ceil(elegiveis.length / tamanho), reservas: 0 };
  }, [elegiveis.length, tamanho, modo]);

  const sortearSimples = () => {
    if (elegiveis.length < 2) {
      toast.error("Poucos jogadores", {
        description: "Precisa de pelo menos 2 confirmados.",
      });
      return;
    }
    setResultado(sortearTimes(elegiveis, tamanho));
    toast.success(`${previa.times} times montados!`);
  };

  /** Sorteio único por ordem de chegada sobre a LISTA COMPLETA de presença. */
  const executarSorteioChegada = () => {
    if (elegiveis.length < 2) {
      toast.error("Poucos jogadores", {
        description: "Há menos de 2 confirmados na lista.",
      });
      return;
    }
    const estado = sortearPrimeiroChegada(elegiveis, 7);
    setEstadoChegada(estado);
    setResultado(null);
    toast.success("Sorteio realizado!", {
      description: `${estado.times.length} times montados com toda a lista de presença.`,
    });
    if (estado.deficit) {
      toast.warning("Sorteio realizado com déficit de goleiros", {
        description: "Jogadores de linha foram escalados no gol para não travar o sorteio.",
      });
    }
  };

  /**
   * Substitui um jogador sorteado por outro disponível (que ainda não tem time).
   * Vale para qualquer sorteio (aleatório, chegada 1ª/2ª etapa e BAxVI).
   */
  const poolSubstituicao = useMemo(() => {
    const times = modo === "chegada" ? estadoChegada?.times : resultado?.times;
    if (!times) return [];
    const alocados = new Set(idsAlocados(times));
    return jogadores.filter((j) => !alocados.has(j.id));
  }, [modo, estadoChegada, resultado, jogadores]);

  const confirmarSubstituicao = () => {
    if (!substituindoId || !substitutoId) return;
    const entrar = jogadores.find((j) => j.id === substitutoId);
    if (!entrar) return;

    if (modo === "chegada" && estadoChegada) {
      const times = substituirJogador(estadoChegada.times, substituindoId, entrar);
      setEstadoChegada({ ...estadoChegada, times, alocados: idsAlocados(times) });
    } else if (resultado) {
      const times = substituirJogador(resultado.times, substituindoId, entrar);
      setResultado({ ...resultado, times });
    }

    const saiu = jogadores.find((j) => j.id === substituindoId);
    toast.success("Jogador substituído!", {
      description: `${saiu?.nome ?? "Quem saiu"} saiu e ${entrar.nome} entrou no time.`,
    });
    setSubstituindoId(null);
    setSubstitutoId("");
  };

  const copiar = async () => {
    if (!timesAtuais || !sessao) return;
    const txt = formatarTimesParaWhatsApp(
      timesAtuais,
      sobrasAtuais,
      format(new Date(sessao.data_horario), "dd/MM 'às' HH:mm", { locale: ptBR }),
    );
    await navigator.clipboard.writeText(txt);
    toast.success("Copiado! Cole no grupo do WhatsApp.");
  };

  if (!sessao) {
    return <p className="text-sm text-muted-foreground">Nenhum baba agendado para sortear.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="card-premium p-5">
        <p className="text-xs uppercase tracking-widest text-gold">Baba do sorteio</p>
        <p className="mt-1 font-display text-2xl">
          {format(new Date(sessao.data_horario), "dd/MM 'às' HH:mm", { locale: ptBR })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {jogadores.length} jogadores elegíveis (
          {jogadores.filter((j) => j.posicao === "goleiro").length} goleiros) •{" "}
          {jogadores.filter((j) => j.ordemChegada != null).length} com chegada confirmada
        </p>
      </div>

      <div className="card-premium p-5">
        <p className="text-xs uppercase tracking-widest text-gold">Modo do sorteio</p>
        <div className="mt-4 flex flex-col gap-3">
          {(
            [
              { v: "aleatorio", t: "Aleatório", d: "Sorteio embaralhado entre todos da lista." },
              {
                v: "chegada",
                t: "Ordem de chegada",
                d: "Duas etapas na ordem do check-in por GPS, com goleiros fixos. Times A e B com os 12 primeiros da linha.",
              },
              {
                v: "baxvi",
                t: "BAxVI (relacionados)",
                d: "Escalação manual do clássico: escolha os associados de Bahia e Vitória.",
              },
            ] as const
          ).map((m) => (
            <Button
              key={m.v}
              variant={modo === m.v ? "gold" : "outline"}
              size="lg"
              className="h-auto w-full flex-col items-start py-3 text-left"
              onClick={() => {
                setModo(m.v);
                setResultado(null);
                setEstadoChegada(null);
              }}
            >
              <span className="font-semibold">{m.t}</span>
              <span className="text-[11px] opacity-80">{m.d}</span>
            </Button>
          ))}
        </div>
      </div>

      {modo === "aleatorio" && (
        <div className="card-premium p-5">
          <p className="text-xs uppercase tracking-widest text-gold">Jogadores por time</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TAMANHOS_TIME.map((t) => (
              <Button
                key={t}
                variant={tamanho === t ? "gold" : "outline"}
                size="lg"
                onClick={() => {
                  setTamanho(t);
                  setResultado(null);
                }}
              >
                {t} por time
              </Button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {elegiveis.length} jogadores nesse modo — dá para formar{" "}
            <strong className="text-foreground">{previa.times}</strong>{" "}
            {previa.times === 1 ? "time" : "times"}. Ninguém fica de reserva; o último time pode
            ficar incompleto.
          </p>
        </div>
      )}

      {modo === "chegada" && (
        <div className="card-premium p-5">
          <p className="text-xs uppercase tracking-widest text-gold">Estrutura dos times</p>
          <p className="mt-2 text-sm text-muted-foreground">
            1 goleiro + 6 jogadores de linha por time (7). Os{" "}
            <strong className="text-foreground">12 primeiros de linha</strong> (ordem de chegada)
            formam os Times A e B (embaralhados entre si).{" "}
            <strong className="text-foreground">Toda a lista de presença</strong> entra no sorteio:
            os demais são embaralhados e espalhados nos Times C em diante, evitando panelinha de
            quem chega tarde.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong className="text-foreground">{elegiveis.length}</strong> jogadores na lista de
            presença —{" "}
            {etapa1Feita
              ? `${estadoChegada!.times.length} times montados.`
              : "clique em “Sortear times” para montar todos de uma vez."}
          </p>
        </div>
      )}

      {modo === "chegada" && (
        <div className="card-premium p-5">
          <p className="text-xs uppercase tracking-widest text-gold">Goleiros — Fixos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Marque como “Fixo” um goleiro com chegada confirmada para ele cobrir mais de um time
            quando faltar goleiro no sorteio (distribuição round-robin).
          </p>
          {goleirosChegados.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum goleiro com chegada confirmada ainda.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {goleirosChegados.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <HandMetal className="size-4 shrink-0 text-gold" />
                    <span className="truncate text-sm text-foreground">{g.nome}</span>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                    Fixo
                    <Switch
                      checked={g.isGoleiroFixo}
                      disabled={toggleFixo.isPending}
                      onCheckedChange={(v) => toggleFixo.mutate({ id: g.id, fixo: v })}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modo === "baxvi" && (
        <div className="space-y-4">
          <div className="card-premium p-5">
            <p className="text-xs uppercase tracking-widest text-gold">⚔️ Relacionados do BAxVI</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nem todo mundo joga todo dia — monte a escalação do clássico escolhendo os associados
              de cada time, como a lista de relacionados do Brasileirão. Depois de salvar, os times
              ficam prontos para lançar resultados e estatísticas.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TimeRelacionado
              nome="Time Bahia"
              time="bahia"
              pool={poolBahia}
              selecionados={relacionados}
              onToggle={selecionarRelacionado}
            />
            <TimeRelacionado
              nome="Time Vitória"
              time="vitoria"
              pool={poolVitoria}
              selecionados={relacionados}
              onToggle={selecionarRelacionado}
            />
          </div>
        </div>
      )}

      {modo === "chegada" ? (
        <div className="space-y-2">
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            disabled={elegiveis.length < 2}
            onClick={executarSorteioChegada}
          >
            <Shuffle className="size-4" /> Sortear times (lista completa)
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="goldOutline" size="lg" disabled={!etapa1Feita} onClick={copiar}>
              <Copy className="size-4" /> WhatsApp
            </Button>
            <Button
              variant="gold"
              size="lg"
              disabled={!etapa1Feita || salvarTimes.isPending}
              onClick={() => salvarTimes.mutate()}
            >
              <Save className="size-4" /> Salvar times
            </Button>
          </div>
        </div>
      ) : modo === "baxvi" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="goldOutline" size="lg" onClick={autoPreencherPorCoracao}>
              <Heart className="size-4" /> Coração
            </Button>
            <Button variant="outline" size="lg" onClick={() => setRelacionados({})}>
              Limpar
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="goldOutline" size="lg" onClick={copiarRelacionados}>
              <Copy className="size-4" /> WhatsApp
            </Button>
            <Button
              variant="hero"
              size="lg"
              disabled={salvarRelacionados.isPending}
              onClick={() => salvarRelacionados.mutate()}
            >
              <Save className="size-4" /> Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="hero" size="lg" onClick={sortearSimples}>
            <Shuffle className="size-4" /> Sortear
          </Button>
          <Button variant="goldOutline" size="lg" onClick={copiar} disabled={!resultado}>
            <Copy className="size-4" /> WhatsApp
          </Button>
          <Button
            variant="gold"
            size="lg"
            className="col-span-2"
            disabled={!resultado || salvarTimes.isPending}
            onClick={() => salvarTimes.mutate()}
          >
            <Save className="size-4" /> Salvar times para resultados
          </Button>
        </div>
      )}

      {timesAtuais && (
        <div className="space-y-3">
          {estadoChegada?.deficit && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600">
              ⚠️ Sorteio realizado com déficit de goleiros — jogadores de linha foram escalados no
              gol para não travar o sorteio.
            </div>
          )}
          {timesAtuais.map((t) => (
            <div key={t.numero} className="card-premium p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-xl">{t.nome}</p>
                <span className="text-xs uppercase tracking-widest text-gold">
                  {(t.goleiro ? 1 : 0) + t.linha.length} jogadores
                </span>
              </div>
              <ul className="space-y-1.5">
                {t.goleiro && (
                  <li key={`g-${t.numero}`} className="flex items-center gap-2 text-sm">
                    <HandMetal className="size-3.5 text-primary" />
                    <NomeJogadorCartinha
                      nome={t.goleiro.nome}
                      usuarioId={
                        t.goleiro.isConvidado
                          ? null
                          : (usuarioPorPresenca.get(t.goleiro.id) ?? null)
                      }
                      className="text-foreground"
                    />
                    {!t.goleiro.isConvidado && (
                      <MicroConquistas usuarioId={usuarioPorPresenca.get(t.goleiro.id) ?? null} />
                    )}
                    {t.goleiro.isGoleiroFixo && (
                      <span className="inline-flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gold">
                        <Lock className="size-3" /> Fixo
                      </span>
                    )}
                    {t.goleiro.isConvidado && (
                      <span className="text-[10px] text-muted-foreground">(convidado)</span>
                    )}
                    {poolSubstituicao.length > 0 && (
                      <SubstituirBotao
                        jogadorId={t.goleiro.id}
                        pool={poolSubstituicao}
                        substituindoId={substituindoId}
                        substitutoId={substitutoId}
                        onIniciar={(id) => {
                          setSubstituindoId(id);
                          setSubstitutoId("");
                        }}
                        onEscolher={setSubstitutoId}
                        onConfirmar={confirmarSubstituicao}
                        onCancelar={() => {
                          setSubstituindoId(null);
                          setSubstitutoId("");
                        }}
                      />
                    )}
                  </li>
                )}
                {t.linha.map((j, idx) => (
                  <li key={`${t.numero}-${j.id}`} className="flex items-center gap-2 text-sm">
                    <span className="w-5 font-display text-gold">{idx + 1}</span>
                    <User className="size-3.5 text-muted-foreground" />
                    <NomeJogadorCartinha
                      nome={j.nome}
                      usuarioId={j.isConvidado ? null : (usuarioPorPresenca.get(j.id) ?? null)}
                      className="text-foreground"
                    />
                    {!j.isConvidado && (
                      <MicroConquistas usuarioId={usuarioPorPresenca.get(j.id) ?? null} />
                    )}
                    {j.isConvidado && (
                      <span className="text-[10px] text-muted-foreground">(convidado)</span>
                    )}
                    {poolSubstituicao.length > 0 && (
                      <SubstituirBotao
                        jogadorId={j.id}
                        pool={poolSubstituicao}
                        substituindoId={substituindoId}
                        substitutoId={substitutoId}
                        onIniciar={(id) => {
                          setSubstituindoId(id);
                          setSubstitutoId("");
                        }}
                        onEscolher={setSubstitutoId}
                        onConfirmar={confirmarSubstituicao}
                        onCancelar={() => {
                          setSubstituindoId(null);
                          setSubstitutoId("");
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {sobrasAtuais.length > 0 && (
            <div className="card-premium p-4">
              <p className="mb-2 font-display text-lg text-muted-foreground">Reservas</p>
              <ul className="space-y-1 text-sm">
                {sobrasAtuais.map((j) => (
                  <li key={j.id}>• {j.nome}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Botão "Substituir" por jogador: abre um seletor de quem entra no lugar. */
function SubstituirBotao({
  jogadorId,
  pool,
  substituindoId,
  substitutoId,
  onIniciar,
  onEscolher,
  onConfirmar,
  onCancelar,
}: {
  jogadorId: string;
  pool: JogadorSorteio[];
  substituindoId: string | null;
  substitutoId: string;
  onIniciar: (id: string) => void;
  onEscolher: (id: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const ativo = substituindoId === jogadorId;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {ativo ? (
        <>
          <Select value={substitutoId} onValueChange={onEscolher}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label="Substituir por">
              <SelectValue placeholder="Quem entra?" />
            </SelectTrigger>
            <SelectContent>
              {pool.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                  {p.posicao === "goleiro" ? " 🧤" : ""}
                  {p.isConvidado ? " (convidado)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="gold" size="sm" disabled={!substitutoId} onClick={onConfirmar}>
            OK
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelar}>
            ✕
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-gold"
          aria-label="Substituir jogador"
          onClick={() => onIniciar(jogadorId)}
        >
          <ArrowLeftRight className="size-3.5" />
        </Button>
      )}
    </span>
  );
}

/** Coluna de um time no modo "Relacionados do BAxVI". */
function TimeRelacionado({
  nome,
  time,
  pool,
  selecionados,
  onToggle,
}: {
  nome: string;
  time: "bahia" | "vitoria";
  pool: {
    id: string;
    nome: string;
    posicao: "goleiro" | "linha";
    time_coracao: "bahia" | "vitoria" | null;
  }[];
  selecionados: Record<string, "bahia" | "vitoria">;
  onToggle: (usuarioId: string, time: "bahia" | "vitoria") => void;
}) {
  const jogadores = pool.filter((u) => selecionados[u.id] === time);
  const goleiros = jogadores.filter((u) => u.posicao === "goleiro").length;
  const corBorda = time === "bahia" ? "border-blue-500/40" : "border-red-500/40";
  const corAtivo =
    time === "bahia" ? "border-blue-500/60 bg-blue-500/10" : "border-red-500/60 bg-red-500/10";

  return (
    <div className={`card-premium p-4 ${corBorda}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-xl">
          {time === "bahia" ? "🔵" : "🔴"} {nome}
        </p>
        <span className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
          <Users className="size-3.5" /> {jogadores.length} · {goleiros} 🧤
        </span>
      </div>
      <ul className="space-y-1.5">
        {pool.map((u) => {
          const marcado = selecionados[u.id] === time;
          const emOutro = selecionados[u.id] != null && selecionados[u.id] !== time;
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onToggle(u.id, time)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  marcado
                    ? corAtivo
                    : emOutro
                      ? "border-border/40 bg-muted/30 opacity-40"
                      : "border-border/60 bg-surface hover:border-gold/40"
                }`}
              >
                <span className="font-medium">{u.nome}</span>
                {u.posicao === "goleiro" && <span aria-hidden>🧤</span>}
                <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
                  {u.time_coracao === "bahia"
                    ? "🔵 Bahia"
                    : u.time_coracao === "vitoria"
                      ? "🔴 Vitória"
                      : "sem time"}
                </span>
                {marcado && <Check className="size-4 shrink-0 text-success" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
