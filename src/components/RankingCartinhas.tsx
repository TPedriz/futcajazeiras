import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { todasCartinhasQuery } from "@/lib/babaQueries";
import { AvatarJogador } from "@/components/AvatarJogador";
import { InstagramLink } from "@/components/InstagramLink";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type LinhaCartinha = Database["public"]["Views"]["ranking_cartinhas"]["Row"];

type ChaveCategoria =
  | "ovr"
  | "stat_ritmo"
  | "stat_finalizacao"
  | "stat_passe"
  | "stat_drible"
  | "stat_defesa"
  | "stat_fisico";

interface CategoriaRanking {
  chave: ChaveCategoria;
  rotulo: string;
  sigla: string;
}

const MEDALHAS = ["🥇", "🥈", "🥉"];

const CATEGORIAS: CategoriaRanking[] = [
  { chave: "ovr", rotulo: "Overall", sigla: "OVR" },
  { chave: "stat_ritmo", rotulo: "Ritmo", sigla: "RIT" },
  { chave: "stat_finalizacao", rotulo: "Finalização", sigla: "FIN" },
  { chave: "stat_passe", rotulo: "Passe", sigla: "PAS" },
  { chave: "stat_drible", rotulo: "Drible", sigla: "DRI" },
  { chave: "stat_defesa", rotulo: "Defesa", sigla: "DEF" },
  { chave: "stat_fisico", rotulo: "Físico", sigla: "FÍS" },
];

/** Ranking das cartinhas: top 3 por categoria (OVR, FIN, PAS, DEF...). */
export function RankingCartinhas() {
  const { data: cartinhas = [] } = useQuery(todasCartinhasQuery());
  const [categoria, setCategoria] = useState<ChaveCategoria>("ovr");

  const cat = CATEGORIAS.find((c) => c.chave === categoria) ?? CATEGORIAS[0];
  const top3: LinhaCartinha[] = [...cartinhas]
    .sort((a, b) => (b[cat.chave] ?? 0) - (a[cat.chave] ?? 0))
    .slice(0, 3);

  if (cartinhas.length === 0) return null;

  return (
    <div className="card-premium space-y-3 p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
        <TrendingUp className="size-4" /> Ranking das cartinhas
      </p>
      <p className="text-xs text-muted-foreground">
        Top 3 por categoria — as melhores cartinhas do baba.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIAS.map((c) => (
          <button
            key={c.chave}
            type="button"
            onClick={() => setCategoria(c.chave)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              c.chave === categoria
                ? "bg-gold text-black"
                : "bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {c.sigla}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {top3.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-3"
          >
            <span className="w-8 text-center text-lg">{MEDALHAS[i]}</span>
            <AvatarJogador caminho={c.avatar_url} nome={c.nome} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.nome}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {cat.rotulo} · {c.posicao === "goleiro" ? "Goleiro" : "Linha"}
              </p>
            </div>
            <InstagramLink valor={c.instagram} compacto className="shrink-0" />
            <p className="font-display text-xl text-gold">{c[cat.chave] ?? 0}</p>
          </div>
        ))}
        {top3.length === 0 && <p className="text-sm text-muted-foreground">Sem cartinhas ainda.</p>}
      </div>
    </div>
  );
}
