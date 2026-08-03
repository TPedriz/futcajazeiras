import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { proximaSessaoQuery, presencasDaSessaoQuery } from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  sortearTimes,
  sortearBaxVi,
  sortearPrimeiroChegada,
  sortearSegundoChegada,
  formatarTimesParaWhatsApp,
  TAMANHOS_TIME,
  type JogadorSorteio,
  type TimeSorteado,
  type SorteioEstado,
} from "@/lib/sorteio";
import { useState, useMemo } from "react";
import { Shuffle, Copy, HandMetal, User, Save, Lock } from "lucide-react";

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
  const [modo, setModo] = useState<"aleatorio" | "chegada" | "baxvi">("aleatorio");

  const qc = useQueryClient();

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

  const elegiveis = useMemo(
    () => (modo === "chegada" ? jogadores.filter((j) => j.ordemChegada != null) : jogadores),
    [jogadores, modo],
  );

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
  const novosRetardatarios = estadoChegada
    ? elegiveis.filter((j) => !estadoChegada.alocados.includes(j.id))
    : [];

  const previa = useMemo(() => {
    if (modo === "baxvi") return { times: 2, reservas: 0 };
    return { times: Math.ceil(elegiveis.length / tamanho), reservas: 0 };
  }, [elegiveis.length, tamanho, modo]);

  const sortearSimples = () => {
    if (modo === "baxvi") {
      const associados = jogadores.filter((j) => !j.isConvidado);
      const r = sortearBaxVi(associados);
      if (r.semTime.length > 0) {
        toast.warning("Alguns associados ficaram sem time", {
          description: `${r.semTime.length} não escolheram Bahia ou Vitória no perfil.`,
        });
      }
      setResultado({ times: r.times, sobras: r.semTime });
      toast.success("BAxVI montado!");
      return;
    }
    if (elegiveis.length < 2) {
      toast.error("Poucos jogadores", {
        description: "Precisa de pelo menos 2 confirmados.",
      });
      return;
    }
    setResultado(sortearTimes(elegiveis, tamanho));
    toast.success(`${previa.times} times montados!`);
  };

  /** 1ª etapa do sorteio por ordem de chegada (times A, B, C... + goleiros). */
  const executarPrimeiro = () => {
    if (elegiveis.length < 2) {
      toast.error("Poucos jogadores", {
        description: "Ninguém marcou chegada por GPS ainda, ou há menos de 2 confirmados.",
      });
      return;
    }
    const estado = sortearPrimeiroChegada(elegiveis, 7);
    setEstadoChegada(estado);
    setResultado(null);
    toast.success("1º sorteio realizado!", {
      description: `${estado.times.length} times montados na ordem de chegada.`,
    });
    if (estado.deficit) {
      toast.warning("Sorteio realizado com déficit de goleiros", {
        description: "Jogadores de linha foram escalados no gol para não travar o sorteio.",
      });
    }
  };

  /** 2ª etapa: encaixa apenas os retardatários (check-ins ainda sem time). */
  const executarSegundo = () => {
    if (!estadoChegada) return;
    if (novosRetardatarios.length === 0) {
      toast.message("Sem retardatários", {
        description: "Todos os check-ins já estão alocados em times.",
      });
      return;
    }
    const estado = sortearSegundoChegada(elegiveis, estadoChegada, 7);
    setEstadoChegada(estado);
    toast.success("2º sorteio realizado!", {
      description: `${novosRetardatarios.length} retardatários foram encaixados.`,
    });
    if (estado.deficit) {
      toast.warning("Sorteio realizado com déficit de goleiros", {
        description: "Jogadores de linha foram escalados no gol para não travar o sorteio.",
      });
    }
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
        <div className="mt-3 grid gap-2">
          {(
            [
              { v: "aleatorio", t: "Aleatório", d: "Sorteio embaralhado entre todos da lista." },
              {
                v: "chegada",
                t: "Ordem de chegada",
                d: "Duas etapas na ordem do check-in por GPS, com goleiros fixos. Times A e B com os 12 primeiros da linha.",
              },
              { v: "baxvi", t: "BAxVI", d: "Bahia x Vitória, exclusivo para associados." },
            ] as const
          ).map((m) => (
            <Button
              key={m.v}
              variant={modo === m.v ? "gold" : "outline"}
              size="lg"
              className="h-auto flex-col items-start py-3 text-left"
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
            <strong className="text-foreground">12 primeiros de linha</strong> formam os Times A e B
            (embaralhados); os demais seguem em ordem de chegada para os Times C em diante.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong className="text-foreground">{elegiveis.length}</strong> jogadores com chegada
            confirmada nesse momento —{" "}
            {etapa1Feita
              ? `${estadoChegada!.times.length} times montados • ${novosRetardatarios.length} retardatários aguardando.`
              : "clique em “Executar 1º Sorteio” para começar."}
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

      {modo === "chegada" ? (
        <div className="space-y-2">
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            disabled={etapa1Feita || elegiveis.length < 2}
            onClick={executarPrimeiro}
          >
            <Shuffle className="size-4" /> Executar 1º Sorteio (Início)
          </Button>
          {etapa1Feita && (
            <Button
              variant="gold"
              size="lg"
              className="w-full"
              disabled={novosRetardatarios.length === 0}
              onClick={executarSegundo}
            >
              <Shuffle className="size-4" /> Executar 2º Sorteio (Retardatários)
            </Button>
          )}
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
                    <span className="text-foreground">{t.goleiro.nome}</span>
                    {t.goleiro.isGoleiroFixo && (
                      <span className="inline-flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gold">
                        <Lock className="size-3" /> Fixo
                      </span>
                    )}
                    {t.goleiro.isConvidado && (
                      <span className="text-[10px] text-muted-foreground">(convidado)</span>
                    )}
                  </li>
                )}
                {t.linha.map((j, idx) => (
                  <li key={`${t.numero}-${j.id}`} className="flex items-center gap-2 text-sm">
                    <span className="w-5 font-display text-gold">{idx + 1}</span>
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="text-foreground">{j.nome}</span>
                    {j.isConvidado && (
                      <span className="text-[10px] text-muted-foreground">(convidado)</span>
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
