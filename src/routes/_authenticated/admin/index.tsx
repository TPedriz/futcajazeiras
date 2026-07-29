import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todasSessoesQuery } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, Lock, Unlock, Trash2, Eye, EyeOff, Navigation } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todasSessoesQuery()),
  component: AdminSessoes,
});

function AdminSessoes() {
  const { data: sessoes } = useSuspenseQuery(todasSessoesQuery());
  const qc = useQueryClient();

  const [dataHorario, setDataHorario] = useState("");
  const [local, setLocal] = useState("Arena Cajazeiras");
  const [lat, setLat] = useState("-12.9088");
  const [lng, setLng] = useState("-38.4142");
  const [raio, setRaio] = useState("1000");

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["sessoes-todas"] });
    qc.invalidateQueries({ queryKey: ["proxima-sessao"] });
  };

  const usarMinhaLocalizacao = () => {
    if (!("geolocation" in navigator)) return toast.error("Localização indisponível neste aparelho");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Coordenadas da arena atualizadas");
      },
      () => toast.error("Não foi possível ler o GPS"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!dataHorario) throw new Error("Informe data e horário");
      const jogo = new Date(dataHorario);
      const fechamento = new Date(jogo.getTime() - 3 * 60 * 60 * 1000);
      const { error } = await supabase.from("sessoes_baba").insert({
        data_horario: jogo.toISOString(),
        local,
        fechamento_lista: fechamento.toISOString(),
        latitude: Number(lat),
        longitude: Number(lng),
        raio_metros: Math.max(100, Number(raio) || 1000),
      });
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Baba criado!");
      setDataHorario("");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const toggleFechado = useMutation({
    mutationFn: async ({ id, fechado }: { id: string; fechado: boolean }) => {
      const { error } = await supabase.from("sessoes_baba").update({ esta_fechado: fechado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidar();
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessoes_baba").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baba excluído");
      invalidar();
    },
  });

  return (
    <div className="space-y-5">
      <div className="card-premium p-5 space-y-3">
        <p className="font-display text-xl">Novo baba</p>
        <div>
          <Label htmlFor="dt">Data e horário</Label>
          <Input id="dt" type="datetime-local" value={dataHorario} onChange={(e) => setDataHorario(e.target.value)} className="h-12" />
        </div>
        <div>
          <Label htmlFor="loc">Local</Label>
          <Input id="loc" value={local} onChange={(e) => setLocal(e.target.value)} className="h-12" />
        </div>
        <Button variant="hero" size="lg" className="w-full" onClick={() => criar.mutate()} disabled={criar.isPending}>
          Criar baba
        </Button>
      </div>

      <div>
        <p className="mb-3 font-display text-xl">Histórico</p>
        {sessoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum baba cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {sessoes.map((s) => (
              <li key={s.id} className="card-premium p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Calendar className="size-4 text-gold" />
                      {format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {s.local}
                    </div>
                    {s.esta_fechado && (
                      <span className="mt-2 inline-block rounded bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-destructive">
                        Fechado
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleFechado.mutate({ id: s.id, fechado: !s.esta_fechado })}>
                      {s.esta_fechado ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => excluir.mutate(s.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
