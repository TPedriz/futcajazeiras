import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  todasSessoesQuery,
  timesDoBabaQuery,
  estatisticasDoBabaQuery,
  perfisPublicosQuery,
} from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Trophy,
  Minus,
  ShieldX,
  Goal,
  Plus,
  RotateCcw,
  Trash2,
  Handshake,
  UserPlus,
  HandMetal,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/resultados")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todasSessoesQuery()),
  component: ResultadosPage,
});

type Resultado = "vitoria" | "derrota" | "empate";

function ResultadosPage() {
  const { data: sessoes } = useSuspenseQuery(todasSessoesQuery());
  const [babaId, setBabaId] = useState<string | undefined>(sessoes[0]?.id);
  const { data: times } = useQuery(timesDoBabaQuery(babaId));
  const { data: stats } = useQuery(estatisticasDoBabaQuery(babaId));
  const { data: perfis } = useQuery(perfisPublicosQuery());
  const qc = useQueryClient();

  const nomes = new Map((perfis ?? []).map((p) => [p.id as string, p.nome as string]));
  const statMap = new Map((stats ?? []).map((s) => [s.usuario_id, s]));

  // ===== CRUD de integrantes (mesmo após o lançamento) =====
  const [adicionarAbertoTimeId, setAdicionarAbertoTimeId] = useState<string | null>(null);
  const [novoIntegranteId, setNovoIntegranteId] = useState("");
  const [novaPosicao, setNovaPosicao] = useState<"goleiro" | "linha">("linha");

  const sessaoAtual = sessoes.find((s) => s.id === babaId);
  const ehBaxvi = sessaoAtual?.tipo === "baxvi";

  /** Jogadores já escalados em qualquer time do baba (para não duplicar). */
  const idsEscalados = new Set<string>(
    (times ?? [])
      .flatMap((t) => (t.times_jogadores ?? []).map((j) => j.usuario_id))
      .filter((id): id is string => !!id),
  );
  const disponiveisParaAdicionar = (perfis ?? []).filter((p) => !idsEscalados.has(p.id as string));

  /** Time do BAxVI correspondente ao nome do time salvo (ou null fora do clássico). */
  const timeNomeRel = (nome: string): "bahia" | "vitoria" | null => {
    if (nome.includes("Bahia")) return "bahia";
    if (nome.includes("Vitória") || nome.includes("Vitoria")) return "vitoria";
    return null;
  };

  /** Ao mexer nos integrantes de um BAxVI, mantém a lista de relacionados sincronizada. */
  const invalidarTimes = () => {
    qc.invalidateQueries({ queryKey: ["times-baba", babaId] });
    qc.invalidateQueries({ queryKey: ["bavi-relacionados", babaId] });
    qc.invalidateQueries({ queryKey: ["ranking-mes"] });
  };

  const adicionarIntegrante = useMutation({
    mutationFn: async ({
      timeId,
      usuarioId,
      posicao,
    }: {
      timeId: string;
      usuarioId: string;
      posicao: "goleiro" | "linha";
    }) => {
      const { error } = await supabase
        .from("times_jogadores")
        .insert({ time_id: timeId, usuario_id: usuarioId, posicao });
      if (error) throw error;

      // No BAxVI, quem entra no time passa a ser relacionado.
      if (ehBaxvi && babaId) {
        const time = times?.find((t) => t.id === timeId);
        const rel = time ? timeNomeRel(time.nome) : null;
        if (rel) {
          const { error: e2 } = await supabase
            .from("bavi_relacionados")
            .upsert(
              { baba_id: babaId, usuario_id: usuarioId, time_nome: rel, posicao },
              { onConflict: "baba_id,usuario_id" },
            );
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => {
      toast.success("Jogador adicionado ao time!");
      setAdicionarAbertoTimeId(null);
      setNovoIntegranteId("");
      setNovaPosicao("linha");
      invalidarTimes();
    },
    onError: (e: Error) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  const removerIntegrante = useMutation({
    mutationFn: async ({ tjId, usuarioId }: { tjId: string; usuarioId: string | null }) => {
      const { error } = await supabase.from("times_jogadores").delete().eq("id", tjId);
      if (error) throw error;
      if (ehBaxvi && babaId && usuarioId) {
        const { error: e2 } = await supabase
          .from("bavi_relacionados")
          .delete()
          .eq("baba_id", babaId)
          .eq("usuario_id", usuarioId);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Jogador removido do time");
      invalidarTimes();
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  const alternarPosicao = useMutation({
    mutationFn: async ({
      tjId,
      usuarioId,
      posicao,
    }: {
      tjId: string;
      usuarioId: string | null;
      posicao: "goleiro" | "linha";
    }) => {
      const nova = posicao === "goleiro" ? "linha" : "goleiro";
      const { error } = await supabase
        .from("times_jogadores")
        .update({ posicao: nova })
        .eq("id", tjId);
      if (error) throw error;
      if (ehBaxvi && babaId && usuarioId) {
        const { error: e2 } = await supabase
          .from("bavi_relacionados")
          .update({ posicao: nova })
          .eq("baba_id", babaId)
          .eq("usuario_id", usuarioId);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Posição atualizada");
      invalidarTimes();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const marcarResultado = useMutation({
    mutationFn: async ({ timeId, resultado }: { timeId: string; resultado: Resultado | null }) => {
      const { error } = await supabase.from("times_baba").update({ resultado }).eq("id", timeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resultado salvo");
      qc.invalidateQueries({ queryKey: ["times-baba", babaId] });
      qc.invalidateQueries({ queryKey: ["ranking-mes"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ["estatisticas-baba"] });
    qc.invalidateQueries({ queryKey: ["times-baba"] });
    qc.invalidateQueries({ queryKey: ["ranking-mes"] });
  };

  const idsDoMes = () => {
    const agora = new Date();
    const ini = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1).getTime();
    return sessoes
      .filter((s) => {
        const t = new Date(s.data_horario).getTime();
        return t >= ini && t < fim;
      })
      .map((s) => s.id);
  };

  const zerarMes = useMutation({
    mutationFn: async () => {
      const ids = idsDoMes();
      if (ids.length === 0) return;
      const { error: e1 } = await supabase.from("estatisticas_baba").delete().in("baba_id", ids);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("times_baba")
        .update({ resultado: null })
        .in("baba_id", ids);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Ranking do mês zerado");
      invalidarTudo();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const zerarTudo = useMutation({
    mutationFn: async () => {
      const ids = sessoes.map((s) => s.id);
      if (ids.length === 0) return;
      const { error: e1 } = await supabase.from("estatisticas_baba").delete().in("baba_id", ids);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("times_baba")
        .update({ resultado: null })
        .in("baba_id", ids);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Estatísticas gerais resetadas");
      invalidarTudo();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const lancarEstatistica = useMutation({
    mutationFn: async ({
      usuarioId,
      campo,
      delta,
    }: {
      usuarioId: string;
      campo:
        | "gols"
        | "assistencias"
        | "penaltis_defendidos"
        | "cartoes_amarelos"
        | "cartoes_azuis"
        | "cartoes_vermelhos"
        | "faltas"
        | "gols_contra";
      delta: number;
    }) => {
      if (!babaId) throw new Error("Selecione um baba");
      const atual = statMap.get(usuarioId);
      const base = {
        gols: atual?.gols ?? 0,
        assistencias: atual?.assistencias ?? 0,
        penaltis_defendidos: atual?.penaltis_defendidos ?? 0,
        cartoes_amarelos: atual?.cartoes_amarelos ?? 0,
        cartoes_azuis: atual?.cartoes_azuis ?? 0,
        cartoes_vermelhos: atual?.cartoes_vermelhos ?? 0,
        faltas: atual?.faltas ?? 0,
        gols_contra: atual?.gols_contra ?? 0,
      };
      const novo = { ...base, [campo]: Math.max(0, base[campo] + delta) };
      const { error } = await supabase
        .from("estatisticas_baba")
        .upsert(
          { baba_id: babaId, usuario_id: usuarioId, ...novo },
          { onConflict: "baba_id,usuario_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estatisticas-baba", babaId] });
      qc.invalidateQueries({ queryKey: ["ranking-mes"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium space-y-2 p-4">
        <p className="text-xs uppercase tracking-widest text-gold">Resultados e estatísticas</p>
        <Select value={babaId} onValueChange={setBabaId}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Selecione o baba" />
          </SelectTrigger>
          <SelectContent>
            {sessoes.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} —{" "}
                {s.local}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Escolha qualquer baba do histórico para lançar ou corrigir gols, assistências e cartões.
          As alterações valem retroativamente e o ranking do mês é recalculado na hora.
        </p>
      </div>

      <div className="card-premium border-destructive/40 p-4">
        <p className="text-xs uppercase tracking-widest text-destructive">Zona de risco</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ações exclusivas da diretoria. Não dá para desfazer.
        </p>
        <div className="mt-3 grid gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={zerarMes.isPending}
            onClick={() => {
              if (
                confirm(
                  "Zerar o ranking deste mês? Gols, cartões e resultados do mês serão apagados.",
                )
              )
                zerarMes.mutate();
            }}
          >
            <RotateCcw className="size-4" /> Zerar ranking do mês
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={zerarTudo.isPending}
            onClick={() => {
              if (confirm("Resetar TODAS as estatísticas do histórico? Essa ação é definitiva."))
                zerarTudo.mutate();
            }}
          >
            <Trash2 className="size-4" /> Resetar estatísticas gerais
          </Button>
        </div>
      </div>

      {(times ?? []).length === 0 && (
        <div className="card-premium p-6 text-center">
          <Trophy className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 font-display text-xl">Nenhum time salvo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça o sorteio na aba Sorteio e clique em “Salvar times” para poder lançar resultados.
          </p>
        </div>
      )}

      {(times ?? []).map((t) => (
        <div key={t.id} className="card-premium p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-xl">{t.nome}</p>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t.resultado ?? "sem resultado"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={t.resultado === "vitoria" ? "success" : "outline"}
              size="sm"
              onClick={() =>
                marcarResultado.mutate({
                  timeId: t.id,
                  resultado: t.resultado === "vitoria" ? null : "vitoria",
                })
              }
            >
              <Trophy className="size-3" /> Venceu
            </Button>
            <Button
              variant={t.resultado === "empate" ? "gold" : "outline"}
              size="sm"
              onClick={() =>
                marcarResultado.mutate({
                  timeId: t.id,
                  resultado: t.resultado === "empate" ? null : "empate",
                })
              }
            >
              <Minus className="size-3" /> Empate
            </Button>
            <Button
              variant={t.resultado === "derrota" ? "destructive" : "outline"}
              size="sm"
              onClick={() =>
                marcarResultado.mutate({
                  timeId: t.id,
                  resultado: t.resultado === "derrota" ? null : "derrota",
                })
              }
            >
              <ShieldX className="size-3" /> Perdeu
            </Button>
          </div>

          {/* CRUD de integrantes — vale mesmo após o lançamento */}
          <div className="mt-3">
            {adicionarAbertoTimeId === t.id ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                <p className="text-xs text-muted-foreground">
                  Adicione um jogador ao time — vale mesmo após o lançamento (substituição, lesão,
                  imprevisto). Não importa o motivo, você decide.
                </p>
                <div className="flex gap-2">
                  <Select value={novoIntegranteId} onValueChange={setNovoIntegranteId}>
                    <SelectTrigger className="h-10 flex-1">
                      <SelectValue placeholder="Escolha o jogador" />
                    </SelectTrigger>
                    <SelectContent>
                      {disponiveisParaAdicionar.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={novaPosicao}
                    onValueChange={(v) => setNovaPosicao(v as "goleiro" | "linha")}
                  >
                    <SelectTrigger className="h-10 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linha">Linha</SelectItem>
                      <SelectItem value="goleiro">Goleiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    className="flex-1"
                    disabled={!novoIntegranteId || adicionarIntegrante.isPending}
                    onClick={() =>
                      adicionarIntegrante.mutate({
                        timeId: t.id,
                        usuarioId: novoIntegranteId,
                        posicao: novaPosicao,
                      })
                    }
                  >
                    <UserPlus className="size-4" /> Adicionar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdicionarAbertoTimeId(null);
                      setNovoIntegranteId("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {disponiveisParaAdicionar.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Todos os jogadores já estão escalados neste baba.
                  </p>
                )}
              </div>
            ) : (
              <Button
                variant="goldOutline"
                size="sm"
                className="w-full"
                onClick={() => setAdicionarAbertoTimeId(t.id)}
              >
                <UserPlus className="size-4" /> Adicionar / substituir jogador
              </Button>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {(t.times_jogadores ?? []).map((j) => {
              const s = j.usuario_id ? statMap.get(j.usuario_id) : undefined;
              const nome =
                j.nome_convidado ??
                (j.usuario_id ? (nomes.get(j.usuario_id) ?? "Jogador") : "Jogador");
              return (
                <li key={j.id} className="rounded-lg border border-border/60 p-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm">
                      {nome}
                      {j.nome_convidado && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(convidado)</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs">
                      {j.usuario_id && (
                        <>
                          <Goal className="size-3 text-gold" /> {s?.gols ?? 0}
                          <Handshake className="ml-1 size-3 text-gold" /> {s?.assistencias ?? 0}
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={j.posicao === "goleiro" ? "Tornar linha" : "Tornar goleiro"}
                        title={j.posicao === "goleiro" ? "Tornar linha" : "Tornar goleiro"}
                        onClick={() =>
                          alternarPosicao.mutate({
                            tjId: j.id,
                            usuarioId: j.usuario_id ?? null,
                            posicao: j.posicao,
                          })
                        }
                        className={`ml-2 rounded px-1.5 py-0.5 transition-colors ${
                          j.posicao === "goleiro"
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <HandMetal className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover ${nome} do time`}
                        title="Remover do time"
                        className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remover ${nome} do time?`))
                            removerIntegrante.mutate({
                              tjId: j.id,
                              usuarioId: j.usuario_id ?? null,
                            });
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  </div>
                  {j.usuario_id && (
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      <StatBtn
                        label="Gol"
                        valor={s?.gols ?? 0}
                        cor="bg-gold/15 text-gold"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "gols",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "gols",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="Assist."
                        valor={s?.assistencias ?? 0}
                        cor="bg-success/15 text-success"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "assistencias",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "assistencias",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="Def. pênalti"
                        valor={s?.penaltis_defendidos ?? 0}
                        cor="bg-violet-500/15 text-violet-400"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "penaltis_defendidos",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "penaltis_defendidos",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="Amar."
                        valor={s?.cartoes_amarelos ?? 0}
                        cor="bg-yellow-500/15 text-yellow-400"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "cartoes_amarelos",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "cartoes_amarelos",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="Azul"
                        valor={s?.cartoes_azuis ?? 0}
                        cor="bg-blue-500/15 text-blue-400"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "cartoes_azuis",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "cartoes_azuis",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="Verm."
                        valor={s?.cartoes_vermelhos ?? 0}
                        cor="bg-destructive/15 text-destructive"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "cartoes_vermelhos",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "cartoes_vermelhos",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="Faltas"
                        valor={s?.faltas ?? 0}
                        cor="bg-amber-600/15 text-amber-500"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "faltas",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "faltas",
                            delta: -1,
                          })
                        }
                      />
                      <StatBtn
                        label="G. contra"
                        valor={s?.gols_contra ?? 0}
                        cor="bg-slate-500/15 text-slate-400"
                        onAdd={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "gols_contra",
                            delta: 1,
                          })
                        }
                        onSub={() =>
                          lancarEstatistica.mutate({
                            usuarioId: j.usuario_id!,
                            campo: "gols_contra",
                            delta: -1,
                          })
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatBtn({
  label,
  valor,
  cor,
  onAdd,
  onSub,
}: {
  label: string;
  valor: number;
  cor: string;
  onAdd: () => void;
  onSub: () => void;
}) {
  return (
    <div className={`rounded-md p-1 text-center ${cor}`}>
      <p className="text-[9px] uppercase tracking-widest">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          onClick={onSub}
          className="px-1 text-sm opacity-70"
        >
          −
        </button>
        <span className="font-display text-base">{valor}</span>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={onAdd} className="px-1">
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}
