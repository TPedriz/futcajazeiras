import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { TodasCartinhas } from "@/components/TodasCartinhas";

export const Route = createFileRoute("/_authenticated/cartinhas")({
  head: () => ({
    meta: [
      { title: "Todas as Cartinhas — Fut Cajazeiras" },
      {
        name: "description",
        content: "Veja as cartinhas de todos os associados do Fut Cajazeiras, com o top 3 em destaque.",
      },
    ],
  }),
  component: CartinhasPage,
});

function CartinhasPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/inicio" aria-label="Voltar" className="shrink-0">
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="font-display text-2xl text-foreground">Todas as Cartinhas</h1>
          <p className="text-xs text-muted-foreground">
            Top 3 de Overall em destaque. Toque em uma cartinha para ver os detalhes.
          </p>
        </div>
      </div>
      <TodasCartinhas />
    </div>
  );
}
