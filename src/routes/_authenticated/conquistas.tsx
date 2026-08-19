import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { perfilAtualQuery } from "@/lib/babaQueries";
import { AchievementFeed } from "@/components/AchievementFeed";
import { AchievementCatalog } from "@/components/AchievementCatalog";
import { GerenciadorConquistas } from "@/components/GerenciadorConquistas";
import { BuscaJogador } from "@/components/BuscaJogador";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Feed de acontecimentos, catálogo de conquistas e suas conquistas no Fut Cajazeiras.",
      },
    ],
  }),
  component: ConquistasPage,
});

function ConquistasPage() {
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const usuarioId = perfilData?.user.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/inicio" aria-label="Voltar" className="shrink-0">
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          <Trophy className="size-6 text-gold" />
          <div>
            <h1 className="font-display text-2xl text-foreground">Conquistas</h1>
            <p className="text-xs text-muted-foreground">
              Sua carreira e os acontecimentos da comunidade.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="feed">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="minhas">Minhas</TabsTrigger>
          <TabsTrigger value="jogadores">Jogadores</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          <AchievementFeed userId={usuarioId} />
        </TabsContent>

        <TabsContent value="catalogo" className="mt-4">
          <AchievementCatalog usuarioId={usuarioId} />
        </TabsContent>

        <TabsContent value="minhas" className="mt-4">
          <GerenciadorConquistas usuarioId={usuarioId} />
        </TabsContent>

        <TabsContent value="jogadores" className="mt-4">
          <BuscaJogador />
        </TabsContent>
      </Tabs>
    </div>
  );
}
