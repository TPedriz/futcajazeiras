import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { RodapeApp } from "@/components/RodapeApp";
import { Button } from "@/components/ui/button";
import { agendaEventosQuery } from "@/lib/babaQueries";
import { AgendaCard } from "@/components/AgendaCard";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda dos Babas — Arena Cajazeiras | Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Agenda pública dos babas e eventos esportivos da Arena Cajazeiras: baba do Fut Cajazeiras, baba de outros grupos e eventos esportivos.",
      },
      { property: "og:title", content: "Agenda dos Babas — Arena Cajazeiras" },
    ],
  }),
  component: AgendaPublicaPage,
});

function AgendaPublicaPage() {
  const { data: eventos, isLoading, isError } = useQuery(agendaEventosQuery());

  const hoje = new Date().toISOString().slice(0, 10);

  const { proximos, passados } = useMemo(() => {
    const lista = (eventos ?? []).filter((e) => e.status !== "cancelado");
    const prox = lista
      .filter((e) => e.data_evento >= hoje || (e.data_evento === hoje && e.status === "agendado"))
      .sort(
        (a, b) =>
          a.data_evento.localeCompare(b.data_evento) || a.hora_inicio.localeCompare(b.hora_inicio),
      );
    const pas = lista
      .filter((e) => e.data_evento < hoje)
      .sort(
        (a, b) =>
          b.data_evento.localeCompare(a.data_evento) || b.hora_inicio.localeCompare(a.hora_inicio),
      );
    return { proximos: prox, passados: pas };
  }, [eventos, hoje]);

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" aria-label="Voltar para o início">
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>
            <BrandLogo size="sm" />
            <span className="font-display text-lg tracking-wider">Fut Cajazeiras</span>
          </div>
          <Link to="/auth">
            <Button variant="goldOutline" size="sm">
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
            <CalendarDays className="size-4" /> Arena Cajazeiras
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-foreground">
            Agenda dos <span className="text-gold">Babas</span>
          </h1>
          <p className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" /> Todos os eventos que acontecem na Arena Cajazeiras
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-premium animate-pulse space-y-3 p-4">
                  <div className="h-5 w-2/3 rounded bg-surface" />
                  <div className="h-3 w-1/2 rounded bg-surface" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="card-premium p-6 text-center">
              <p className="font-display text-xl">Não foi possível carregar a agenda</p>
              <p className="mt-1 text-sm text-muted-foreground">Tente novamente em instantes.</p>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              {/* Próximos eventos */}
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
                  Próximos eventos
                </h2>
                {proximos.length === 0 ? (
                  <p className="card-premium p-6 text-center text-sm text-muted-foreground">
                    Nenhum evento agendado por enquanto. Volte em breve!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {proximos.map((e) => (
                      <AgendaCard key={e.id} evento={e} />
                    ))}
                  </div>
                )}
              </section>

              {/* Eventos passados */}
              {passados.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Eventos passados
                  </h2>
                  <div className="space-y-3">
                    {passados.slice(0, 10).map((e) => (
                      <AgendaCard key={e.id} evento={e} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Quer participar dos babas?</p>
          <Link to="/auth" search={{ modo: "cadastro" }}>
            <Button variant="hero" size="lg">
              Vem jogar com a gente!
            </Button>
          </Link>
        </div>
      </main>

      <RodapeApp transparente />
    </div>
  );
}
