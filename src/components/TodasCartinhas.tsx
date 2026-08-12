import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { todasCartinhasQuery } from "@/lib/babaQueries";
import { AvatarJogador } from "@/components/AvatarJogador";
import { useCartinha } from "@/components/CartinhaModal";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type LinhaCartinha = Database["public"]["Views"]["ranking_cartinhas"]["Row"];

const MEDALHAS = ["🥇", "🥈", "🥉"];

/** Borda de destaque gradual pela posição (1º ouro, 2º prata, 3º bronze). */
const BORDAS_DESTAQUE = [
  "border-2 border-amber-400/80 shadow-[0_0_22px_rgba(251,191,36,0.22)]",
  "border-2 border-slate-300/70 shadow-[0_0_18px_rgba(203,213,225,0.18)]",
  "border-2 border-orange-700/60 shadow-[0_0_16px_rgba(194,120,50,0.16)]",
];

/**
 * Browser de cartinhas: top 3 por Overall em destaque (com borda gradual pela
 * posição) e o restante em ordem alfabética. Toque/click abre a cartinha.
 */
export function TodasCartinhas({ compact = false }: { compact?: boolean }) {
  const { data: cartinhas = [] } = useQuery(todasCartinhasQuery());
  const { abrirCartinha } = useCartinha();

  const porOvr: LinhaCartinha[] = [...cartinhas].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
  const top3 = porOvr.slice(0, 3);
  const top3Ids = new Set(top3.map((c) => c.id));
  const restantes: LinhaCartinha[] = [...cartinhas]
    .filter((c) => !top3Ids.has(c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="card-premium space-y-3 p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
        <Trophy className="size-4" /> Todas as cartinhas
      </p>
      <p className="text-xs text-muted-foreground">
        Top 3 de Overall em destaque. Toque em uma cartinha para ver os detalhes.
      </p>

      {/* Top 3 (destaque por Overall) */}
      <div className="space-y-2">
        {top3.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => abrirCartinha(c.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left transition-colors hover:bg-surface-elevated",
              BORDAS_DESTAQUE[i],
            )}
          >
            <span className="w-8 text-center text-xl">{MEDALHAS[i]}</span>
            <AvatarJogador caminho={c.avatar_url} nome={c.nome} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{c.nome}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.posicao === "goleiro" ? "Goleiro" : "Linha"} · Overall
              </p>
            </div>
            <span className="font-display text-2xl text-gold">{c.ovr ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Demais cartinhas, em ordem alfabética */}
      {restantes.length > 0 ? (
        <ul className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          {restantes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => abrirCartinha(c.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-surface p-2.5 text-left transition-colors hover:bg-surface-elevated"
              >
                <AvatarJogador caminho={c.avatar_url} nome={c.nome} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {c.posicao === "goleiro" ? "Goleiro" : "Linha"}
                  </p>
                </div>
                <span className="font-display text-lg text-gold">{c.ovr ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sem cartinhas ainda.</p>
      )}
    </div>
  );
}
