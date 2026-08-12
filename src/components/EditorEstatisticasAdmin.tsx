import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todasSessoesQuery, estatisticasDoBabaQuery } from "@/lib/babaQueries";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Campo =
  | "gols"
  | "assistencias"
  | "penaltis_defendidos"
  | "cartoes_amarelos"
  | "cartoes_azuis"
  | "cartoes_vermelhos"
  | "faltas"
  | "gols_contra";

const CAMPOS: { chave: Campo; rotulo: string; cor: string }[] = [
  { chave: "gols", rotulo: "Gols", cor: "text-gold" },
  { chave: "assistencias", rotulo: "Assistências", cor: "text-sky-400" },
  { chave: "penaltis_defendidos", rotulo: "Pênaltis def.", cor: "text-violet-400" },
  { chave: "cartoes_amarelos", rotulo: "Amarelos", cor: "text-yellow-400" },
  { chave: "cartoes_azuis", rotulo: "Azuis", cor: "text-blue-400" },
  { chave: "cartoes_vermelhos", rotulo: "Vermelhos", cor: "text-red-400" },
  { chave: "faltas", rotulo: "Faltas", cor: "text-orange-400" },
  { chave: "gols_contra", rotulo: "Gols contra", cor: "text-rose-400" },
];

const ZEROS: Record<Campo, number> = {
  gols: 0,
  assistencias: 0,
  penaltis_defendidos: 0,
  cartoes_amarelos: 0,
  cartoes_azuis: 0,
  cartoes_vermelhos: 0,
  faltas: 0,
  gols_contra: 0,
};

/** Editor direto de estatísticas de um usuário em um baba (painel admin). */
export function EditorEstatisticasAdmin({
  usuarioId,
  nome,
}: {
  usuarioId: string;
  nome: string;
}) {
  const qc = useQueryClient();
  const { data: sessoes } = useQuery(todasSessoesQuery());
  const [babaId, setBabaId] = useState<string>("");
  const { data: stats } = useQuery(estatisticasDoBabaQuery(babaId || undefined));
  const [form, setForm] = useState<Record<Campo, number>>(ZEROS);

  // Ao trocar o baba, pré-carrega as estatísticas do usuário naquele baba.
  useEffect(() => {
    const s = (stats ?? []).find((x) => x.usuario_id === usuarioId);
    setForm({
      gols: s?.gols ?? 0,
      assistencias: s?.assistencias ?? 0,
      penaltis_defendidos: s?.penaltis_defendidos ?? 0,
      cartoes_amarelos: s?.cartoes_amarelos ?? 0,
      cartoes_azuis: s?.cartoes_azuis ?? 0,
      cartoes_vermelhos: s?.cartoes_vermelhos ?? 0,
      faltas: s?.faltas ?? 0,
      gols_contra: s?.gols_contra ?? 0,
    });
  }, [babaId, stats, usuarioId]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["estatisticas-baba", babaId] });
    qc.invalidateQueries({ queryKey: ["ranking-mes"] });
    qc.invalidateQueries({ queryKey: ["estatisticas-usuario", usuarioId] });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!babaId) throw new Error("Escolha o baba");
      const { error } = await supabase
        .from("estatisticas_baba")
        .upsert(
          { baba_id: babaId, usuario_id: usuarioId, ...form },
          { onConflict: "baba_id,usuario_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estatísticas salvas!", {
        description: "Ranking do mês e cartinha recalculados.",
      });
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const limpar = useMutation({
    mutationFn: async () => {
      if (!babaId) throw new Error("Escolha o baba");
      const { error } = await supabase
        .from("estatisticas_baba")
        .delete()
        .eq("baba_id", babaId)
        .eq("usuario_id", usuarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estatísticas removidas");
      setForm(ZEROS);
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Edite as estatísticas de <strong className="text-foreground">{nome}</strong> em um baba
        específico. Gols, assistências, cartões, faltas e gols contra — o ranking do mês e a
        cartinha são recalculados na hora.
      </p>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Baba</Label>
        <Select value={babaId} onValueChange={setBabaId}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Selecione o baba" />
          </SelectTrigger>
          <SelectContent>
            {(sessoes ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CAMPOS.map((c) => (
          <div key={c.chave} className="space-y-1 rounded-lg border border-border/60 bg-surface p-2">
            <Label className={`text-[10px] uppercase tracking-widest ${c.cor}`}>{c.rotulo}</Label>
            <Input
              type="number"
              min={0}
              className="h-9"
              value={form[c.chave]}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  [c.chave]: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="hero"
          className="flex-1"
          disabled={!babaId || salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          variant="outline"
          disabled={!babaId || limpar.isPending}
          onClick={() => limpar.mutate()}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
