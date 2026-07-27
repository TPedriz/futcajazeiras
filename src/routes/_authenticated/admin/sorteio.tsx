import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { proximaSessaoQuery, presencasDaSessaoQuery } from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { sortearTimes, formatarTimesParaWhatsApp, type JogadorSorteio, type TimeSorteado } from "@/lib/sorteio";
import { useState, useMemo } from "react";
import { Shuffle, Copy, HandMetal, User, Save } from "lucide-react";
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
  const [resultado, setResultado] = useState<{ times: TimeSorteado[]; sobras: JogadorSorteio[] } | null>(null);
  const [tamanho, setTamanho] = useState<number>(7);

  const qc = useQueryClient();

  const usuarioPorPresenca = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of presencas ?? []) m.set(p.id, p.nome_convidado ? null : p.usuario_id);
    return m;
  }, [presencas]);

  const salvarTimes = useMutation({
    mutationFn: async () => {
      if (!resultado || !sessao) throw new Error("Sorteie os times primeiro");
      await supabase.from("times_baba").delete().eq("baba_id", sessao.id);
      for (const t of resultado.times) {
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
      toast.success("Times salvos!", { description: "Agora lance os resultados na aba Resultados." });
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
        posicao: (p.nome_convidado ? "linha" : (p.perfis?.posicao ?? "linha")) as "goleiro" | "linha",
        isConvidado: !!p.nome_convidado,
      }));
  }, [presencas]);

  const previa = useMemo(() => {
    const t = Math.floor(jogadores.length / tamanho);
    return { times: t, reservas: jogadores.length - t * tamanho };
  }, [jogadores.length, tamanho]);

  const sortear = () => {
    if (jogadores.length < tamanho) {
      toast.error("Poucos jogadores", { description: `Precisa de pelo menos ${tamanho} confirmados.` });
      return;
    }
    setResultado(sortearTimes(jogadores, tamanho));
    toast.success(`${previa.times} times sorteados!`);
  };


  const copiar = async () => {
    if (!resultado || !sessao) return;
    const txt = formatarTimesParaWhatsApp(
      resultado.times,
      resultado.sobras,
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
          {jogadores.length} jogadores elegíveis ({jogadores.filter((j) => j.posicao === "goleiro").length} goleiros)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="hero" size="lg" onClick={sortear}>
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

      {resultado && (
        <div className="space-y-3">
          {resultado.times.map((t) => (
            <div key={t.numero} className="card-premium p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-xl">{t.nome}</p>
                <span className="text-xs uppercase tracking-widest text-gold">
                  {(t.goleiro ? 1 : 0) + t.linha.length} jogadores
                </span>
              </div>
              <ul className="space-y-1.5">
                {t.goleiro && (
                  <li className="flex items-center gap-2 text-sm">
                    <HandMetal className="size-3.5 text-primary" />
                    <span className="text-foreground">{t.goleiro.nome}</span>
                    {t.goleiro.isConvidado && <span className="text-[10px] text-muted-foreground">(convidado)</span>}
                  </li>
                )}
                {t.linha.map((j, idx) => (
                  <li key={j.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 font-display text-gold">{idx + 1}</span>
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="text-foreground">{j.nome}</span>
                    {j.isConvidado && <span className="text-[10px] text-muted-foreground">(convidado)</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {resultado.sobras.length > 0 && (
            <div className="card-premium p-4">
              <p className="mb-2 font-display text-lg text-muted-foreground">Reservas</p>
              <ul className="space-y-1 text-sm">
                {resultado.sobras.map((j) => (
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
