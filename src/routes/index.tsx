import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BrandLogo } from "@/components/BrandLogo";
import { RodapeApp } from "@/components/RodapeApp";
import { Button } from "@/components/ui/button";
import { proximosEventosAgendaQuery } from "@/lib/babaQueries";
import {
  Calendar,
  Users,
  Trophy,
  ChevronRight,
  Zap,
  Sparkles,
  Layers,
  Star,
  CalendarDays,
  Clock,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { formatarHora, diaDaSemanaCurto, rotuloCategoriaEvento } from "@/lib/redeSocial";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fut Cajazeiras — Baba com organização de time premium" },
      {
        name: "description",
        content:
          "O baba do Fut Cajazeiras na palma da mão: check-in, convidados, pagamentos e sorteio de times direto pelo celular.",
      },
      { property: "og:title", content: "Fut Cajazeiras — Baba com organização de time premium" },
      {
        property: "og:description",
        content: "Confirme presença, leve seu convidado e acompanhe o baba direto pelo celular.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.futcajazeiras.com.br/" },
    ],
    links: [{ rel: "canonical", href: "https://www.futcajazeiras.com.br/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SportsOrganization",
              name: "Fut Cajazeiras",
              url: "https://www.futcajazeiras.com.br/",
              sport: "Soccer",
            },
            {
              "@type": "WebSite",
              name: "Fut Cajazeiras",
              url: "https://www.futcajazeiras.com.br/",
              description:
                "Plataforma de gestão do baba do Fut Cajazeiras: presenças, convidados, mensalidades e sorteio de times.",
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
            <Button variant="goldOutline" size="sm">
              Entrar
            </Button>
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
          Confirme presença, gerencie seu convidado, acompanhe pagamento e receba os times sorteados
          — tudo direto pelo celular.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/auth" search={{ modo: "cadastro" }}>
            <Button variant="hero" size="xl" className="w-full">
              Vem jogar com a gente!
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="goldOutline" size="xl" className="w-full">
              Já sou associado
            </Button>
          </Link>
        </div>
      </section>

      {/* Próximos Babas — agenda pública da Arena Cajazeiras */}
      <ProximosBabas />

      {/* Gamificação: XP, conquistas e cartinhas */}
      <section className="mx-auto max-w-md px-4 pb-8">
        <div className="rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/15 to-transparent p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Agora o baba tem jogo fora de campo também
          </p>
          <h2 className="mt-2 font-display text-4xl leading-tight text-foreground">
            Cada gol, cada presença, cada vitória —{" "}
            <span className="text-gold">vira evolução.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            No Fut Cajazeiras sua raça no campo agora conta pontos de verdade. Confirme presença,
            balance a rede, dê aquela assistência — e veja seu jogador crescer: ganhe XP, suba de
            nível e conquiste seu lugar entre as lendas do baba.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            Sua jornada vira uma <strong className="text-gold">cartinha de craque</strong> — com
            OVR, atributos e visual de Ultimate Team, calculados do seu desempenho real e prontos
            para você mostrar pro mundo.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <FeatureCard
            Icon={Zap}
            title="XP e níveis"
            text="Cada presença confirmada vale +15 XP, cada gol +8 XP e cada assistência +5 XP. Suba de nível e acompanhe seu progresso no Perfil."
          />
          <FeatureCard
            Icon={Sparkles}
            title="Conquistas"
            text="Desbloqueie medalhas automáticas (Primeira Presença, Artilheiro, Nível 3, Veterano...) e destaque até 3 delas ao lado do seu nome."
          />
          <FeatureCard
            Icon={Layers}
            title="Cartinhas de jogador"
            text="OVR e atributos (RIT, FIN, PAS, DRI, DEF, FÍS) calculados do seu desempenho real. Temas Bronze, Prata, Ouro e especiais (TOTW, Lenda, Paredão)."
          />
          <FeatureCard
            Icon={Star}
            title="Compartilhe sua cartinha"
            text="Baixe sua cartinha em PNG ou compartilhe direto no WhatsApp/Instagram direto do seu Perfil."
          />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/auth" search={{ modo: "cadastro" }}>
            <Button variant="hero" size="xl" className="w-full">
              Comece sua jornada
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="goldOutline" size="xl" className="w-full">
              Já sou associado — ver minha cartinha
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

      <RodapeApp transparente />
    </div>
  );
}

function FeatureCard({
  Icon,
  title,
  text,
}: {
  Icon: typeof Calendar;
  title: string;
  text: string;
}) {
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

/** Seção "Próximos Babas" da landing — agenda pública da Arena Cajazeiras. */
function ProximosBabas() {
  const { data: eventos } = useQuery(proximosEventosAgendaQuery(5));

  return (
    <section className="mx-auto max-w-md px-4 pb-10">
      <div className="rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/15 to-transparent p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
            <CalendarDays className="size-4" /> Próximos babas
          </p>
          <Link
            to="/agenda"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
          >
            Ver agenda completa <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Eventos que acontecem na Arena Cajazeiras
        </p>

        <div className="mt-4 space-y-2">
          {eventos && eventos.length === 0 && (
            <p className="rounded-xl border border-border/50 bg-surface/60 p-4 text-center text-sm text-muted-foreground">
              Nenhum evento agendado por enquanto. Volte em breve!
            </p>
          )}
          {eventos?.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface/70 p-3"
            >
              <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-gold/30 bg-gold/5 py-1 text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {diaDaSemanaCurto(`${e.data_evento}T12:00:00`)}
                </span>
                <span className="font-display text-lg leading-none text-gold">
                  {format(new Date(`${e.data_evento}T12:00:00`), "dd", { locale: ptBR })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{e.titulo}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" /> {formatarHora(e.hora_inicio)}
                  <span aria-hidden>•</span>
                  <MapPin className="size-3" /> {e.local}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gold">
                {rotuloCategoriaEvento(e.categoria)}
              </span>
            </div>
          ))}
        </div>

        <Link to="/agenda" className="mt-4 block">
          <Button variant="goldOutline" size="lg" className="w-full">
            Ver agenda completa <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
