import { useQuery } from "@tanstack/react-query";
import { rankingDoMesQuery, mesReferencia } from "@/lib/babaQueries";
import { Trophy, Goal, Medal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RankingMensal() {
  const referencia = mesReferencia();
  const { data, isLoading } = useQuery(rankingDoMesQuery(referencia));

  const top = [...(data ?? [])]
    .sort(
      (a, b) =>
        (b.gols ?? 0) - (a.gols ?? 0) ||
        (b.vitorias ?? 0) - (a.vitorias ?? 0) ||
        (a.derrotas ?? 0) - (b.derrotas ?? 0),
    )
    .slice(0, 5);

  return (
    <section className="card-premium p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Ranking do mês</p>
          <h2 className="font-display text-2xl capitalize">
            {format(new Date(`${referencia}T12:00:00`), "MMMM", { locale: ptBR })}
          </h2>
        </div>
        <Trophy className="size-6 text-gold" />
      </div>

      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando ranking...</p>}

      {!isLoading && top.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ainda não há gols nem resultados lançados neste mês.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {top.map((r, i) => (
          <li key={r.usuario_id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${
                i === 0 ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
              }`}
            >
              {i === 0 ? <Medal className="size-4" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.nome}</span>
            <span className="flex items-center gap-1 text-sm text-gold">
              <Goal className="size-3.5" /> {r.gols ?? 0}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              <strong className="text-foreground">{r.vitorias ?? 0}</strong>V ·{" "}
              <strong className="text-foreground">{r.derrotas ?? 0}</strong>D
            </span>
            <span className="flex items-center gap-0.5">
              {(r.cartoes_amarelos ?? 0) > 0 && (
                <span className="rounded-sm bg-yellow-400 px-1 text-[9px] font-bold text-black">
                  {r.cartoes_amarelos}
                </span>
              )}
              {(r.cartoes_azuis ?? 0) > 0 && (
                <span className="rounded-sm bg-blue-500 px-1 text-[9px] font-bold text-white">{r.cartoes_azuis}</span>
              )}
              {(r.cartoes_vermelhos ?? 0) > 0 && (
                <span className="rounded-sm bg-destructive px-1 text-[9px] font-bold text-white">
                  {r.cartoes_vermelhos}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
