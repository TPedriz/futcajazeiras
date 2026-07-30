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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Minus, ShieldX, Goal, Plus, RotateCcw, Trash2, Handshake } from "lucide-react";

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
      const { error: e2 } = await supabase.from("times_baba").update({ resultado: null }).in("baba_id", ids);
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
      const { error: e2 } = await supabase.from("times_baba").update({ resultado: null }).in("baba_id", ids);
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
      campo: "gols" | "assistencias" | "cartoes_amarelos" | "cartoes_azuis" | "cartoes_vermelhos";
      delta: number;
    }) => {
      if (!babaId) throw new Error("Selecione um baba");
      const atual = statMap.get(usuarioId);
      const base = {
        gols: atual?.gols ?? 0,
        assistencias: atual?.assistencias ?? 0,
        cartoes_amarelos: atual?.cartoes_amarelos ?? 0,
        cartoes_azuis: atual?.cartoes_azuis ?? 0,
        cartoes_vermelhos: atual?.cartoes_vermelhos ?? 0,
      };
      const novo = { ...base, [campo]: Math.max(0, base[campo] + delta) };
      const { error } = await supabase
        .from("estatisticas_baba")
        .upsert({ baba_id: babaId, usuario_id: usuarioId, ...novo }, { onConflict: "baba_id,usuario_id" });
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
                {format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {s.local}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Escolha qualquer baba do histórico para lançar ou corrigir gols, assistências e cartões. As alterações
          valem retroativamente e o ranking do mês é recalculado na hora.
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
              if (confirm("Zerar o ranking deste mês? Gols, cartões e resultados do mês serão apagados."))
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
              onClick={() => marcarResultado.mutate({ timeId: t.id, resultado: t.resultado === "vitoria" ? null : "vitoria" })}
            >
              <Trophy className="size-3" /> Venceu
            </Button>
            <Button
              variant={t.resultado === "empate" ? "gold" : "outline"}
              size="sm"
              onClick={() => marcarResultado.mutate({ timeId: t.id, resultado: t.resultado === "empate" ? null : "empate" })}
            >
              <Minus className="size-3" /> Empate
            </Button>
            <Button
              variant={t.resultado === "derrota" ? "destructive" : "outline"}
              size="sm"
              onClick={() => marcarResultado.mutate({ timeId: t.id, resultado: t.resultado === "derrota" ? null : "derrota" })}
            >
              <ShieldX className="size-3" /> Perdeu
            </Button>
          </div>

          <ul className="mt-3 space-y-2">
            {(t.times_jogadores ?? []).map((j) => {
              const s = j.usuario_id ? statMap.get(j.usuario_id) : undefined;
              const nome = j.nome_convidado ?? (j.usuario_id ? nomes.get(j.usuario_id) ?? "Jogador" : "Jogador");
              return (
                <li key={j.id} className="rounded-lg border border-border/60 p-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm">
                      {nome}
                      {j.nome_convidado && <span className="ml-1 text-[10px] text-muted-foreground">(convidado)</span>}
                    </span>
                    {j.usuario_id && (
                      <span className="flex items-center gap-1 text-xs text-gold">
                        <Goal className="size-3" /> {s?.gols ?? 0}
                        <Handshake className="ml-2 size-3" /> {s?.assistencias ?? 0}
                      </span>
                    )}
                  </div>
                  {j.usuario_id && (
                    <div className="mt-2 grid grid-cols-5 gap-1">
                      <StatBtn label="Gol" valor={s?.gols ?? 0} cor="bg-gold/15 text-gold"
                        onAdd={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "gols", delta: 1 })}
                        onSub={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "gols", delta: -1 })} />
                      <StatBtn label="Assist." valor={s?.assistencias ?? 0} cor="bg-success/15 text-success"
                        onAdd={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "assistencias", delta: 1 })}
                        onSub={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "assistencias", delta: -1 })} />
                      <StatBtn label="Amar." valor={s?.cartoes_amarelos ?? 0} cor="bg-yellow-500/15 text-yellow-400"
                        onAdd={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "cartoes_amarelos", delta: 1 })}
                        onSub={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "cartoes_amarelos", delta: -1 })} />
                      <StatBtn label="Azul" valor={s?.cartoes_azuis ?? 0} cor="bg-blue-500/15 text-blue-400"
                        onAdd={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "cartoes_azuis", delta: 1 })}
                        onSub={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "cartoes_azuis", delta: -1 })} />
                      <StatBtn label="Verm." valor={s?.cartoes_vermelhos ?? 0} cor="bg-destructive/15 text-destructive"
                        onAdd={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "cartoes_vermelhos", delta: 1 })}
                        onSub={() => lancarEstatistica.mutate({ usuarioId: j.usuario_id!, campo: "cartoes_vermelhos", delta: -1 })} />
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
        <button type="button" aria-label={`Diminuir ${label}`} onClick={onSub} className="px-1 text-sm opacity-70">
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
