import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  todasSessoesQuery,
  estatisticasDoBabaQuery,
  todosAssociadosQuery,
} from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Goal, Handshake, Trophy, Trash2, Plus, Save, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/estatisticas")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(todasSessoesQuery()),
      context.queryClient.ensureQueryData(todosAssociadosQuery()),
    ]),
  component: EstatisticasPage,
});

type Campo = "gols" | "assistencias" | "cartoes_amarelos" | "cartoes_azuis" | "cartoes_vermelhos";

const CAMPOS: { campo: Campo; rotulo: string; icone: typeof Goal; cor: string }[] = [
  { campo: "gols", rotulo: "Gols", icone: Goal, cor: "text-gold" },
  { campo: "assistencias", rotulo: "Assistências", icone: Handshake, cor: "text-success" },
  { campo: "cartoes_amarelos", rotulo: "Amarelos", icone: Trophy, cor: "text-yellow-400" },
  { campo: "cartoes_azuis", rotulo: "Azuis", icone: Trophy, cor: "text-blue-400" },
  { campo: "cartoes_vermelhos", rotulo: "Vermelhos", icone: Trophy, cor: "text-destructive" },
];

function EstatisticasPage() {
  const { data: sessoes } = useSuspenseQuery(todasSessoesQuery());
  const { data: todos } = useSuspenseQuery(todosAssociadosQuery());
  const qc = useQueryClient();

  const [babaId, setBabaId] = useState<string | undefined>(sessoes[0]?.id);
  const [usuarioId, setUsuarioId] = useState<string>("");

  const { data: stats } = useQuery(estatisticasDoBabaQuery(babaId));
  const statDoUsuario = (stats ?? []).find((s) => s.usuario_id === usuarioId);

  const [form, setForm] = useState({
    gols: 0,
    assistencias: 0,
    cartoes_amarelos: 0,
    cartoes_azuis: 0,
    cartoes_vermelhos: 0,
  });

  const definirUsuario = (id: string) => {
    setUsuarioId(id);
    const s = (stats ?? []).find((x) => x.usuario_id === id);
    setForm({
      gols: s?.gols ?? 0,
      assistencias: s?.assistencias ?? 0,
      cartoes_amarelos: s?.cartoes_amarelos ?? 0,
      cartoes_azuis: s?.cartoes_azuis ?? 0,
      cartoes_vermelhos: s?.cartoes_vermelhos ?? 0,
    });
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["estatisticas-baba", babaId] });
    qc.invalidateQueries({ queryKey: ["ranking-mes"] });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!babaId || !usuarioId) throw new Error("Selecione o baba e o usuário");
      const { error } = await supabase
        .from("estatisticas_baba")
        .upsert(
          { baba_id: babaId, usuario_id: usuarioId, ...form },
          { onConflict: "baba_id,usuario_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estatísticas salvas!");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const remover = useMutation({
    mutationFn: async () => {
      if (!babaId || !usuarioId) throw new Error("Selecione o baba e o usuário");
      const { error } = await supabase
        .from("estatisticas_baba")
        .delete()
        .eq("baba_id", babaId)
        .eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estatísticas removidas");
      setUsuarioId("");
      setForm({
        gols: 0,
        assistencias: 0,
        cartoes_amarelos: 0,
        cartoes_azuis: 0,
        cartoes_vermelhos: 0,
      });
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const nomes = new Map((todos ?? []).map((u) => [u.id, u.nome]));
  const temStats = (stats ?? []).filter((s) => !!s.usuario_id);

  return (
    <div className="space-y-4">
      <div className="card-premium space-y-3 p-4">
        <p className="text-xs uppercase tracking-widest text-gold">Lançar estatísticas manuais</p>
        <p className="text-sm text-muted-foreground">
          Corrija ou complete gols, assistências e cartões de qualquer usuário em qualquer baba do
          histórico — útil quando o sorteio falhou e os times não foram salvos. O ranking do mês é
          recalculado na hora.
        </p>

        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Baba</Label>
          <Select
            value={babaId}
            onValueChange={(v) => {
              setBabaId(v);
              setUsuarioId("");
            }}
          >
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
        </div>

        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Usuário</Label>
          <Select value={usuarioId} onValueChange={definirUsuario}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Selecione o usuário" />
            </SelectTrigger>
            <SelectContent>
              {(todos ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {usuarioId && (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
            <p className="text-sm font-semibold">
              {nomes.get(usuarioId) ?? "Jogador"}
              {statDoUsuario && (
                <span className="ml-2 text-[11px] text-muted-foreground">(já tem lançamento)</span>
              )}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {CAMPOS.map(({ campo, rotulo, icone, cor }) => (
                <div key={campo} className="rounded-md bg-background p-2 text-center">
                  <p
                    className={`flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest ${cor}`}
                  >
                    <icone className="size-3" /> {rotulo}
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      aria-label={`Diminuir ${rotulo}`}
                      className="px-1 text-sm opacity-70"
                      onClick={() => setForm((f) => ({ ...f, [campo]: Math.max(0, f[campo] - 1) }))}
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-10 px-0 text-center font-display"
                      value={form[campo]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [campo]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Aumentar ${rotulo}`}
                      className="px-1"
                      onClick={() => setForm((f) => ({ ...f, [campo]: f[campo] + 1 }))}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="gold"
                size="lg"
                className="flex-1"
                disabled={salvar.isPending}
                onClick={() => salvar.mutate()}
              >
                <Save className="size-4" /> Salvar
              </Button>
              {statDoUsuario && (
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={remover.isPending}
                  onClick={() => {
                    if (confirm("Remover as estatísticas desse usuário nesse baba?"))
                      remover.mutate();
                  }}
                >
                  <Trash2 className="size-4" /> Remover
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card-premium p-4">
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
          <Trophy className="size-4" /> Já lançados nesse baba
        </p>
        {temStats.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma estatística lançada nesse baba ainda. Use o formulário acima para adicionar.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {temStats.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 p-2 text-left hover:bg-surface"
                  onClick={() => definirUsuario(s.usuario_id)}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <User className="size-3 text-muted-foreground" />
                    {nomes.get(s.usuario_id) ?? "Jogador"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ⚽ {s.gols} • 🅰️ {s.assistencias} • 🟨 {s.cartoes_amarelos} • 🟦{" "}
                    {s.cartoes_azuis} • 🟥 {s.cartoes_vermelhos}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
