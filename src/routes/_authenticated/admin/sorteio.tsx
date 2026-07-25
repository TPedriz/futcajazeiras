import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { proximaSessaoQuery, presencasDaSessaoQuery } from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { sortearTimes, formatarParaWhatsApp, type JogadorSorteavel, type Time } from "@/lib/sorteio";
import { useState, useMemo } from "react";
import { Shuffle, Copy, HandMetal, User } from "lucide-react";
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
  const [times, setTimes] = useState<Time[] | null>(null);

  const jogadores: JogadorSorteavel[] = useMemo(() => {
    if (!presencas) return [];
    return presencas
      .filter((p) => !p.nome_convidado || p.status_convidado === "aprovado")
      .map((p) => ({
        id: p.id,
        nome: p.nome_convidado ?? p.perfis?.nome ?? "Jogador",
        posicao: p.nome_convidado ? "linha" : (p.perfis?.posicao ?? "linha"),
      }));
  }, [presencas]);

  const sortear = () => {
    if (jogadores.length < 4) {
      toast.error("Poucos jogadores", { description: "Precisa de pelo menos 4 confirmados." });
      return;
    }
    setTimes(sortearTimes(jogadores));
    toast.success("Times sorteados!");
  };

  const copiar = async () => {
    if (!times || !sessao) return;
    const txt = formatarParaWhatsApp(
      times,
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
        <Button variant="goldOutline" size="lg" onClick={copiar} disabled={!times}>
          <Copy className="size-4" /> WhatsApp
        </Button>
      </div>

      {times && (
        <div className="space-y-3">
          {times.map((t) => (
            <div key={t.numero} className="card-premium p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-xl">Time {t.numero}</p>
                <span className="text-xs uppercase tracking-widest text-gold">
                  {t.jogadores.length} jogadores
                </span>
              </div>
              <ul className="space-y-1.5">
                {t.jogadores.map((j, idx) => (
                  <li key={j.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 font-display text-gold">{idx + 1}</span>
                    {j.posicao === "goleiro" ? (
                      <HandMetal className="size-3.5 text-primary" />
                    ) : (
                      <User className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="text-foreground">{j.nome}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
