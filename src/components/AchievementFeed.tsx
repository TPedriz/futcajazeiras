import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscaEventosFeed, FEED_PAGE_SIZE } from "@/lib/babaQueries";
import {
  EVENTOS_IMPORTANTES,
  rotuloTipoEvento,
  type SocialEvento,
  type TipoEventoFeed,
} from "@/lib/feed";
import { SocialEventCard } from "@/components/SocialEventCard";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Canal único por montagem (mesmo padrão do NotificacoesProvider).
let contadorCanais = 0;

/**
 * Feed global de acontecimentos da comunidade.
 *
 * - Query normal (fallback): funciona mesmo sem Realtime.
 * - Realtime: novos eventos entram no topo de forma idempotente (sem duplicar).
 * - Estados: loading (skeleton), empty, error (não quebra a página), paginação.
 * - Toast de celebração para eventos importantes do próprio usuário.
 */
export function AchievementFeed({
  userId,
  limiteInicial = FEED_PAGE_SIZE,
  mostrarToast = true,
}: {
  userId?: string | undefined;
  limiteInicial?: number;
  mostrarToast?: boolean;
}) {
  const qc = useQueryClient();
  const [nomeCanal] = useState(() => `feed-global-${++contadorCanais}`);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery({
      queryKey: ["feed-global"],
      initialPageParam: null as { criado_em: string } | null,
      queryFn: ({ pageParam }) =>
        buscaEventosFeed({ limite: limiteInicial, antesDe: pageParam?.criado_em }),
      getNextPageParam: (lastPage) =>
        lastPage.length >= limiteInicial
          ? { criado_em: lastPage[lastPage.length - 1].criado_em }
          : undefined,
    });

  // Realtime: novo evento -> refetch (server é a fonte de verdade, sem duplicar);
  // toast p/ eventos importantes do próprio usuário (usa o payload cru).
  useEffect(() => {
    if (!userId) return;
    const canal = supabase
      .channel(nomeCanal)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feed_eventos" },
        (payload) => {
          const novo = payload.new as Partial<SocialEvento> | undefined;
          if (!novo?.id || novo.visibilidade !== "VISIVEL") return;

          // Refetch do feed e da prévia da Home (sem inserir card "cru" no cache).
          void qc.invalidateQueries({ queryKey: ["feed-global"] });
          void qc.invalidateQueries({ queryKey: ["feed-global-preview"] });

          // Toast de celebração para eventos importantes do próprio usuário.
          if (mostrarToast && novo.usuario_id === userId) {
            const tipo = novo.tipo ?? "";
            if (EVENTOS_IMPORTANTES.has(tipo as TipoEventoFeed)) {
              toast("🏆 " + rotuloTipoEvento(tipo), {
                description: novo.titulo ?? "Novo acontecimento no Fut Cajazeiras!",
              });
            }
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId, qc, nomeCanal, mostrarToast]);

  const eventos = (data?.pages ?? []).flat();
  const carregandoMais = isFetchingNextPage;

  // ---------- Estados ----------
  if (isLoading) {
    return <FeedSkeleton quantidade={3} />;
  }

  if (isError) {
    return (
      <div className="card-premium flex flex-col items-center gap-3 p-6 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <p className="font-display text-xl">Não foi possível carregar o feed</p>
        <p className="text-sm text-muted-foreground">
          Tente novamente em instantes. A página continua funcionando normalmente.
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="card-premium flex flex-col items-center gap-3 p-6 text-center">
        <Trophy className="size-10 text-gold/70" />
        <p className="font-display text-xl">Ainda não há grandes conquistas por aqui.</p>
        <p className="text-sm text-muted-foreground">Continue jogando. A próxima pode ser sua!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eventos.map((e, i) => (
        <SocialEventCard key={e.id} evento={e} destaque={i === 0} />
      ))}

      {hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          disabled={carregandoMais}
          onClick={() => void fetchNextPage()}
        >
          {carregandoMais ? "Carregando..." : "Carregar mais"}
        </Button>
      )}
    </div>
  );
}

/** Skeleton de carregamento do feed. */
export function FeedSkeleton({ quantidade = 3 }: { quantidade?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="card-premium animate-pulse space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-surface" />
            <div className="h-3 w-32 rounded bg-surface" />
          </div>
          <div className="h-10 w-3/4 rounded-xl bg-surface" />
          <div className="h-3 w-1/2 rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
