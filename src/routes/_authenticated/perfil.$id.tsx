import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Swords,
  Trophy,
  Target,
  CalendarClock,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";
import {
  perfilAtualQuery,
  perfilPublicoQuery,
  minhasConquistasQuery,
  totaisConquistasQuery,
  cartinhaPublicaQuery,
  eventosDoUsuarioQuery,
  conquistasEmDestaqueQuery,
  rankingDoMesQuery,
  mesReferencia,
} from "@/lib/babaQueries";
import { progressoNivel } from "@/lib/gamificacao";
import { rankingDeCategoria } from "@/lib/gamificacao";
import { AvatarJogador } from "@/components/AvatarJogador";
import { InstagramLink } from "@/components/InstagramLink";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/PlayerCard";
import { SocialEventCard } from "@/components/SocialEventCard";
import { ConquistadoresModal } from "@/components/ConquistadoresModal";
import type { ConquistaResumoModal } from "@/components/ConquistadoresModal";
import { temaEfetivo } from "@/lib/cartinha";
import { rotuloCategoriaConquista } from "@/lib/gamificacao";

export const Route = createFileRoute("/_authenticated/perfil/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Perfil — Fut Cajazeiras` }],
  }),
  component: PerfilPublicoPage,
});

function PerfilPublicoPage() {
  const { id } = Route.useParams();
  const { data: sessaoAtual } = useSuspenseQuery(perfilAtualQuery());
  const { data: perfil } = useQuery(perfilPublicoQuery(id));

  const souEu = sessaoAtual?.user.id === id;
  const [conquistaAberta, setConquistaAberta] = useState<ConquistaResumoModal | null>(null);

  const { data: totais } = useQuery(totaisConquistasQuery(id));
  const { data: conquistas } = useQuery(minhasConquistasQuery(id));
  const { data: cartinha } = useQuery(cartinhaPublicaQuery(id));
  const { data: eventos } = useQuery(eventosDoUsuarioQuery(id, 10));
  const { data: destaques } = useQuery(conquistasEmDestaqueQuery());
  const { data: rankingMes } = useQuery(rankingDoMesQuery(mesReferencia()));

  const nivel = perfil?.nivel_atual ?? totais?.nivel ?? 1;
  const xp = perfil?.xp_atual ?? totais?.xp ?? 0;
  const prog = progressoNivel(xp);

  // TOTW do mês (top 1 em gols/assistências/pênaltis) para a cartinha.
  const top1Mes =
    (rankingDeCategoria(rankingMes ?? [], "gols").find((r) => r.usuario_id === id)?.posicao ??
      99) === 1 ||
    (rankingDeCategoria(rankingMes ?? [], "assistencias").find((r) => r.usuario_id === id)
      ?.posicao ?? 99) === 1 ||
    (rankingDeCategoria(rankingMes ?? [], "penaltis").find((r) => r.usuario_id === id)?.posicao ??
      99) === 1;

  const temaCarta = cartinha?.tema_carta
    ? temaEfetivo(cartinha.tema_carta as "bronze" | "prata" | "ouro", { top1Mes })
    : null;
  const meusDestaques = (destaques?.get(id) ?? []).slice(0, 3);

  const conquistasDoPerfil = conquistas ?? [];
  const totalConquistas = conquistasDoPerfil.length;

  const stats = [
    { icone: Target, rotulo: "Presenças", valor: totais?.presencas ?? 0 },
    { icone: Trophy, rotulo: "Gols", valor: totais?.gols ?? 0 },
    { icone: Zap, rotulo: "Assistências", valor: totais?.assistencias ?? 0 },
    { icone: Swords, rotulo: "Vitórias", valor: totais?.vitorias ?? 0 },
    { icone: Shield, rotulo: "Pênaltis defendidos", valor: totais?.penaltisDefendidos ?? 0 },
    { icone: Trophy, rotulo: "Conquistas", valor: totalConquistas },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/inicio" aria-label="Voltar" className="shrink-0">
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>
        <h1 className="font-display text-2xl text-foreground">Perfil público</h1>
        {souEu && (
          <Link to="/perfil" className="ml-auto">
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" /> Editar meu perfil
            </Button>
          </Link>
        )}
      </div>

      {/* Identidade */}
      <div className="card-premium p-6 text-center">
        <div className="mx-auto w-fit">
          <AvatarJogador caminho={perfil?.avatar_url} nome={perfil?.nome} size="lg" />
        </div>
        <h2 className="mt-3 font-display text-3xl tracking-wider text-foreground">
          {perfil?.nome ?? "Jogador"}
        </h2>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {perfil?.posicao === "goleiro" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-0.5 text-[11px] uppercase tracking-widest">
              🧤 Goleiro
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-0.5 text-[11px] uppercase tracking-widest">
              ⚽ Linha
            </span>
          )}
          {perfil?.time_coracao === "bahia" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] uppercase tracking-widest text-blue-400">
              🔵 Bahia
            </span>
          )}
          {perfil?.time_coracao === "vitoria" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] uppercase tracking-widest text-red-400">
              🔴 Vitória
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <InstagramLink valor={perfil?.instagram} className="text-sm" />
        </div>

        {/* Nível + XP */}
        <div className="mx-auto mt-4 max-w-xs space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-display text-lg tracking-wider text-violet-300">
              <Zap className="size-4" /> NÍVEL {nivel}
            </span>
            <span className="text-xs text-muted-foreground">{xp.toLocaleString("pt-BR")} XP</span>
          </div>
          <Progress value={prog.progresso * 100} className="h-2" />
          <p className="text-[11px] text-muted-foreground">
            {prog.xpNoNivel} / {prog.xpParaProximo} XP para o próximo nível
          </p>
        </div>

        {/* Conquistas em destaque */}
        {meusDestaques.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {meusDestaques.map((c) => (
              <span
                key={c.id}
                title={c.nome}
                className="rounded-lg border border-gold/30 bg-surface px-2 py-1 text-lg"
              >
                {c.icone}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="card-premium p-4">
        <p className="mb-3 text-xs uppercase tracking-widest text-gold">Estatísticas</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.rotulo}
              className="rounded-lg border border-border/60 bg-surface p-3 text-center"
            >
              <s.icone className="mx-auto size-4 text-muted-foreground" aria-hidden />
              <p className="mt-1 font-display text-2xl text-foreground">{s.valor}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.rotulo}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Carta do jogador */}
      {cartinha && (
        <div className="card-premium p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-gold">Carta do jogador</p>
          <div className="flex justify-center">
            <div className="w-64">
              <PlayerCard
                nome={cartinha.nome ?? perfil?.nome ?? "Jogador"}
                fotoUrl={perfil?.avatar_url ?? null}
                posicao={(cartinha.posicao as "goleiro" | "linha") ?? "linha"}
                ovr={cartinha.ovr ?? 40}
                pac={cartinha.stat_ritmo ?? 40}
                sho={cartinha.stat_finalizacao ?? 40}
                pas={cartinha.stat_passe ?? 40}
                dri={cartinha.stat_drible ?? 40}
                def={cartinha.stat_defesa ?? 40}
                phy={cartinha.stat_fisico ?? 40}
                nivel={nivel}
                tema={temaCarta ?? "ouro"}
                conquistas={meusDestaques}
                instagram={perfil?.instagram}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conquistas */}
      <div className="card-premium p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-gold">🏆 Conquistas</p>
          <span className="text-xs text-muted-foreground">
            {totalConquistas} {totalConquistas === 1 ? "conquista" : "conquistas"}
          </span>
        </div>

        {totalConquistas === 0 ? (
          <p className="text-sm text-muted-foreground">
            {souEu
              ? "Você ainda não desbloqueou conquistas. Continue jogando!"
              : "Este jogador ainda não desbloqueou conquistas."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {conquistasDoPerfil.map((uc) => {
              const c = uc.conquistas;
              if (!c) return null;
              return (
                <button
                  key={uc.id}
                  onClick={() =>
                    setConquistaAberta({
                      id: c.id,
                      nome: c.nome,
                      icone: c.icone,
                      cor: c.cor,
                      raridade: c.raridade ?? "comum",
                      descricao: c.descricao,
                    })
                  }
                  className="text-left transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  aria-label={`Ver jogadores com a conquista ${c.nome}`}
                >
                  <div className="flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2">
                    <span className="text-lg leading-none">{c.icone}</span>
                    <span className="text-xs font-semibold text-foreground">{c.nome}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Toque em uma conquista para ver quem também a desbloqueou.
        </p>
      </div>

      {/* Atividade recente */}
      <div className="card-premium p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="size-4 text-gold" />
          <p className="text-xs uppercase tracking-widest text-gold">Atividade recente</p>
        </div>
        {eventos && eventos.length > 0 ? (
          <div className="space-y-3">
            {eventos.map((e) => (
              <SocialEventCard key={e.id} evento={e} userId={sessaoAtual?.user.id} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum acontecimento recente por aqui ainda.
          </p>
        )}
      </div>

      <ConquistadoresModal
        conquista={conquistaAberta}
        aberto={!!conquistaAberta}
        onAbertoChange={(aberto) => {
          if (!aberto) setConquistaAberta(null);
        }}
      />
    </div>
  );
}
