import { Sparkles, Zap, Trophy, Crown, TrendingUp, Flame, Medal, UserRound } from "lucide-react";
import { AvatarJogador } from "@/components/AvatarJogador";
import { AchievementBadge } from "@/components/AchievementBadge";
import { AchievementRarity } from "@/components/AchievementRarity";
import {
  dataRelativa,
  metadataEvento,
  rotuloTipoEvento,
  textoApoioEvento,
  type SocialEvento,
  type TipoEventoFeed,
} from "@/lib/feed";

const ICONES_TIPO: Record<string, typeof Trophy> = {
  CONQUISTA_DESBLOQUEADA: Trophy,
  CONQUISTA_RARA: Sparkles,
  NIVEL_ALCANCADO: Zap,
  MARCA_ATINGIDA: Flame,
  RECORDE_PESSOAL: TrendingUp,
  RANKING_ALCANCADO: Crown,
  EVENTO_HISTORICO: Medal,
};

function IconeTipo({ tipo }: { tipo: string }) {
  const Icone = ICONES_TIPO[tipo] ?? Trophy;
  return <Icone className="size-4" />;
}

/**
 * Card de um acontecimento do feed global.
 * Mostra SOMENTE dados públicos: nome, avatar, conquista, estatística e data.
 */
export function SocialEventCard({
  evento,
  destaque = false,
}: {
  evento: SocialEvento;
  /** Primeiro card da lista (recebe destaque visual). */
  destaque?: boolean;
}) {
  const meta = metadataEvento(evento.metadata);
  const nome = evento.perfis_publicos?.nome ?? "Jogador";
  const avatar = evento.perfis_publicos?.avatar_url ?? null;
  const apoia = textoApoioEvento(evento);
  const tipo = evento.tipo as TipoEventoFeed;

  return (
    <article className={`card-premium p-4 transition-colors ${destaque ? "border-gold/40" : ""}`}>
      <div className="flex items-start gap-3">
        <AvatarJogador caminho={avatar} nome={nome} size="sm" />

        <div className="min-w-0 flex-1">
          {/* Cabeçalho: nome + tipo */}
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
            <span className="hidden items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline-flex">
              <IconeTipo tipo={evento.tipo} />
              {rotuloTipoEvento(evento.tipo)}
            </span>
          </div>

          {/* Conquista / nível em destaque */}
          {evento.tipo === "NIVEL_ALCANCADO" ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-violet-300 shadow-[0_0_16px_rgba(167,139,250,0.3)]">
              <Zap className="size-5" />
              <span className="font-display text-lg tracking-wider">NÍVEL {meta.nivel_novo}</span>
            </div>
          ) : evento.conquistas ? (
            <div className="mt-2">
              <AchievementBadge
                conquista={{
                  id: evento.conquistas.id,
                  nome: evento.conquistas.nome,
                  icone: evento.conquistas.icone,
                  cor: evento.conquistas.cor,
                  raridade: evento.conquistas.raridade,
                }}
              />
            </div>
          ) : (
            <p className="mt-1 text-sm font-medium text-foreground">{evento.titulo}</p>
          )}

          {/* Estatística relacionada (sem texto livre) */}
          {apoia && (
            <p className="mt-2 text-xs text-muted-foreground">
              <UserRound className="mr-1 inline size-3" />
              {apoia}
            </p>
          )}

          {/* Rodapé: raridade + data relativa */}
          <div className="mt-3 flex items-center justify-between gap-2">
            {evento.conquistas ? (
              <AchievementRarity raridade={evento.conquistas.raridade} />
            ) : (
              <span />
            )}
            <time className="shrink-0 text-[11px] text-muted-foreground">
              {dataRelativa(evento.criado_em)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}
