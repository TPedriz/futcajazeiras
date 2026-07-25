import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Trophy, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fut Cajazeiras — Baba com organização de time premium" },
      { name: "description", content: "O baba do Fut Cajazeiras na palma da mão: check-in, convidados, pagamentos e sorteio de times direto pelo celular." },
      { property: "og:title", content: "Fut Cajazeiras — Baba com organização de time premium" },
      { property: "og:description", content: "Confirme presença, leve seu convidado e acompanhe o baba direto pelo celular." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://futcajazeiras.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://futcajazeiras.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SportsOrganization",
              name: "Fut Cajazeiras",
              url: "https://futcajazeiras.lovable.app/",
              sport: "Soccer",
            },
            {
              "@type": "WebSite",
              name: "Fut Cajazeiras",
              url: "https://futcajazeiras.lovable.app/",
              description: "Plataforma de gestão do baba do Fut Cajazeiras: presenças, convidados, mensalidades e sorteio de times.",
            },
          ],
        }),
      },
    ],
  }),

  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/inicio" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="font-display text-lg tracking-wider">Fut Cajazeiras</span>
          </div>
          <Link to="/auth">
            <Button variant="goldOutline" size="sm">Entrar</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-md px-4 pt-8 pb-12 text-center">
        <BrandLogo size="xl" className="mx-auto" />
        <p className="mt-4 inline-block rounded-full border border-gold/40 bg-gold/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-gold">
          Temporada 2026
        </p>
        <h1 className="mt-4 font-display text-5xl leading-tight text-foreground">
          O baba do <span className="text-gold">Fut Cajazeiras</span> na palma da mão
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Confirme presença, gerencie seu convidado, acompanhe pagamento e receba os times sorteados —
          tudo direto pelo celular.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/auth" search={{ modo: "cadastro" }}>
            <Button variant="hero" size="xl" className="w-full">
              Solicitar entrada
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="goldOutline" size="xl" className="w-full">
              Já sou associado
            </Button>
          </Link>
        </div>
      </section>

      {/* Cards informativos */}
      <section className="mx-auto max-w-md px-4 pb-16 space-y-4">
        <FeatureCard
          Icon={Calendar}
          title="Como funciona o baba"
          text="Toda semana uma sessão marcada. Confirme sua presença até 3 horas antes do jogo."
        />
        <FeatureCard
          Icon={Users}
          title="Regras e horários"
          text="Fut 7 com times sorteados no local. Um convidado por associado, sujeito à aprovação da diretoria."
        />
        <FeatureCard
          Icon={Trophy}
          title="Benefícios do associado"
          text="Prioridade no check-in, status financeiro claro e presença garantida no time sorteado."
        />
      </section>

      <footer className="border-t border-border/50 bg-background/50 py-6">
        <div className="mx-auto max-w-md px-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Fut Cajazeiras — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ Icon, title, text }: { Icon: typeof Calendar; title: string; text: string }) {
  return (
    <div className="card-premium p-5 flex gap-4 items-start">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-primary">
        <Icon className="size-5 text-primary-foreground" />
      </div>
      <div className="flex-1">
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
      <ChevronRight className="size-5 text-muted-foreground/40" />
    </div>
  );
}
