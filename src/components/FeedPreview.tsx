import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { feedGlobalPreviewQuery, perfilAtualQuery } from "@/lib/babaQueries";
import { SocialEventCard } from "@/components/SocialEventCard";
import { FeedSkeleton } from "@/components/AchievementFeed";
import { Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Canal único por montagem (mesmo padrão do NotificacoesProvider).
let contadorCanais = 0;

/**
 * Prévia do feed na Home autenticada: os 3 últimos acontecimentos
 * da comunidade + link "Ver todos" para /conquistas.
 * Realtime atualiza a prévia; sem Realtime, segue funcionando por query normal.
 */
export function FeedPreview() {
  const qc = useQueryClient();
  const [nomeCanal] = useState(() => `feed-preview-${++contadorCanais}`);
  const { data: eventos, isLoading, isError } = useQuery(feedGlobalPreviewQuery());
  const { data: perfilData } = useQuery(perfilAtualQuery());

  // Realtime: novo evento -> invalida a prévia (atualiza o cache).
  useEffect(() => {
    const canal = supabase
      .channel(nomeCanal)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_eventos" }, () => {
        void qc.invalidateQueries({ queryKey: ["feed-global-preview"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc, nomeCanal]);

  if (isLoading) {
    return (
      <div className="card-premium space-y-3 p-4">
        <Titulo />
        <FeedSkeleton quantidade={1} />
      </div>
    );
  }

  if (isError) {
    // Erro na prévia não pode quebrar a Home.
    return null;
  }

  const lista = eventos ?? [];

  return (
    <div className="card-premium space-y-3 p-4">
      <Titulo />

      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          🏆 Ainda não há grandes conquistas por aqui. Continue jogando — a próxima pode ser sua!
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {lista.map((e) => (
              <SocialEventCard key={e.id} evento={e} userId={perfilData?.user.id} />
            ))}
          </div>
          <Link to="/conquistas" className="block">
            <Button variant="goldOutline" size="lg" className="w-full">
              Ver todos <ArrowRight className="size-4" />
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}

function Titulo() {
  return (
    <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
      <Trophy className="size-4" /> Acontecimentos da comunidade
    </p>
  );
}
