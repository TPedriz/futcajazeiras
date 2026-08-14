import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  perfilAtualQuery,
  proximaSessaoQuery,
  proximasSessoesQuery,
  sessoesPassadasQuery,
  presencasDaSessaoQuery,
  babasPagosConvidadoQuery,
  fechamentoEfetivo,
  aberturaEfetivo,
  META_CONVIDADO,
  baviRelacionadosQuery,
  perfisPublicosQuery,
} from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  Clock,
  Hourglass,
  Lock,
  CalendarClock,
  Trophy,
  Sparkles,
  Swords,
  Flame,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RankingMensal } from "@/components/RankingMensal";
import { RankingCartinhas } from "@/components/RankingCartinhas";
import { TodasCartinhas } from "@/components/TodasCartinhas";
import { BadgeBaxvi } from "@/components/BadgeBaxvi";
import { tempoDeAssociado } from "@/lib/associado";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

type ListaModo = "abre" | "fecha" | "encerrada" | "diretoria";

/** Estado da lista num instante: aberta / ainda não abriu / encerrada / fechada pela diretoria. */
function modoLista(
  agora: number,
  abertura: Date | null,
  fechamento: Date | null,
  fechadaPelaDiretoria: boolean,
): ListaModo {
  if (fechadaPelaDiretoria) return "diretoria";
  if (!abertura || !fechamento) return "fecha";
  if (agora < abertura.getTime()) return "abre";
  if (agora >= fechamento.getTime()) return "encerrada";
  return "fecha";
}

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Painel do associado: veja seu status de mensalidade, o próximo baba e faça check-in direto pelo celular.",
      },
      { property: "og:title", content: "Painel do Associado — Fut Cajazeiras" },
      {
        property: "og:description",
        content: "Seu status financeiro e o próximo baba do Fut Cajazeiras em um só lugar.",
      },
    ],
  }),

  loader: ({ context }) => {
    context.queryClient.ensureQueryData(proximaSessaoQuery());
  },
  component: InicioPage,
});

function InicioPage() {
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const { data: proxSessao } = useSuspenseQuery(proximaSessaoQuery());
  const { data: presencas } = useQuery(presencasDaSessaoQuery(proxSessao?.id));
  const { data: proximasBruto } = useQuery(proximasSessoesQuery());
  const { data: passados } = useQuery(sessoesPassadasQuery());
  const { data: babasPagos } = useQuery(babasPagosConvidadoQuery(perfilData?.user.id));
  const proximas = (proximasBruto ?? []).filter((s) => s.id !== proxSessao?.id);

  const nome = perfilData?.perfil?.nome ?? "Atleta";
  const emDia = perfilData?.perfil?.status_pagamento === "pago";
  const isConvidado = perfilData?.isConvidado ?? false;
  const jogados = Math.min(babasPagos ?? 0, META_CONVIDADO);
  const totalConfirmados = presencas?.filter((p) => !p.nome_convidado).length ?? 0;
  const tempo = tempoDeAssociado(perfilData?.perfil?.criado_em);

  const abertura = proxSessao ? aberturaEfetivo(proxSessao) : null;
  const fechamento = proxSessao ? fechamentoEfetivo(proxSessao) : null;
  const listaAberta =
    modoLista(Date.now(), abertura, fechamento, !!proxSessao?.esta_fechado) === "fecha";

  return (
    <div className="space-y-5 md:grid md:grid-cols-[18rem_minmax(0,1fr)_18rem] md:items-start md:gap-6">
      {/* Lateral esquerda (desktop): todas as cartinhas fixas ao lado */}
      <aside className="hidden md:col-start-1 md:row-start-1 md:self-start md:sticky md:top-4 md:block">
        <TodasCartinhas compact />
      </aside>

      {/* Coluna central (mobile: tudo empilhado; desktop: meio) */}
      <div className="space-y-5 md:col-start-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Boa!</p>
          <h1 className="font-display text-4xl leading-tight text-foreground">
            {nome.split(" ")[0]}
          </h1>
          {tempo && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-gold">{tempo.apelido}</span> — no baba há{" "}
              <strong className="text-foreground">{tempo.texto}</strong>.
            </p>
          )}
        </div>

        {/* Status financeiro */}
        <div className={emDia ? "card-vip p-5" : "card-premium border-destructive/40 p-5"}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {isConvidado ? "Diária de convidado" : "Mensalidade"}
              </p>
              <p
                className={`mt-1 font-display text-3xl ${emDia ? "text-gold" : isConvidado ? "" : "text-destructive"}`}
              >
                {isConvidado ? "Paga a diária por baba" : emDia ? "Em dia" : "Pendente"}
              </p>
            </div>
            <div
              className={`flex size-14 items-center justify-center rounded-full ${
                isConvidado ? "bg-gold/10" : emDia ? "bg-gold/10" : "bg-destructive/10"
              }`}
            >
              {isConvidado ? (
                <CheckCircle2 className="size-7 text-gold" />
              ) : emDia ? (
                <CheckCircle2 className="size-7 text-gold" />
              ) : (
                <AlertCircle className="size-7 text-destructive" />
              )}
            </div>
          </div>
          {isConvidado ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Convidados não pagam mensalidade — apenas a diária de cada baba que participam.
            </p>
          ) : !emDia ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Regularize sua mensalidade com a diretoria para manter a prioridade no check-in.
            </p>
          ) : null}
        </div>

        {/* Caminho para virar associado (convidados) */}
        {isConvidado && (
          <Link to="/perfil">
            <div className="card-premium p-5 hover:border-gold/40 transition-colors">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
                  <Trophy className="size-4" /> Caminho para virar Associado
                </p>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Faltam{" "}
                <strong className="font-display text-2xl text-gold">
                  {META_CONVIDADO - jogados}
                </strong>{" "}
                {META_CONVIDADO - jogados === 1 ? "baba pago" : "babas pagos"} para liberar o
                pedido.
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {jogados}/{META_CONVIDADO} babas pagos
                </span>
                <span>Toque para ver como funciona</span>
              </div>
              <Progress value={(jogados / META_CONVIDADO) * 100} className="mt-1 h-2" />
            </div>
          </Link>
        )}

        {/* Próximo Baba — BAxVI vira evento especial */}
        {proxSessao ? (
          proxSessao.tipo === "baxvi" ? (
            <CardBavi sessao={proxSessao} abertura={abertura} fechamento={fechamento} />
          ) : (
            <Link to="/baba">
              <div className="card-premium p-5 hover:border-gold/40 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-gold">Próximo Baba</p>
                </div>
                <h2 className="mt-1 font-display text-2xl text-foreground">
                  {format(new Date(proxSessao.data_horario), "EEEE, dd 'de' MMMM", {
                    locale: ptBR,
                  })}
                </h2>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-gold" />
                    <span>
                      {format(new Date(proxSessao.data_horario), "HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-gold" />
                    <span>{proxSessao.local}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-gold" />
                    <span>{totalConfirmados} associados confirmados</span>
                  </div>
                  {abertura && fechamento && (
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-gold" />
                      <span>
                        Abre {format(abertura, "dd/MM 'às' HH:mm", { locale: ptBR })} · Fecha{" "}
                        {format(fechamento, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
                <ListaStatus
                  abertura={abertura}
                  fechamento={fechamento}
                  fechadaPelaDiretoria={proxSessao.esta_fechado}
                />
                <div className="mt-4 flex items-center justify-end gap-1 text-sm font-semibold text-gold">
                  Ver detalhes <ArrowRight className="size-4" />
                </div>
              </div>
            </Link>
          )
        ) : (
          <div className="card-premium p-6 text-center">
            <Calendar className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 font-display text-xl">Nenhum baba agendado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aguarde a diretoria marcar a próxima sessão.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <Link to="/baba">
            <Button variant="hero" size="xl" className="w-full">
              {proxSessao?.tipo === "baxvi"
                ? "Ver escalação do clássico"
                : listaAberta
                  ? "Confirmar minha presença"
                  : "Ver detalhes do baba"}
            </Button>
          </Link>
        </div>

        {proximas.length > 0 && (
          <div className="card-premium p-5">
            <p className="text-xs uppercase tracking-widest text-gold">Próximos babas</p>
            <ul className="mt-3 space-y-2">
              {proximas.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-3"
                >
                  <Calendar className="size-4 shrink-0 text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {format(new Date(s.data_horario), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      {s.tipo === "baxvi" && <BadgeBaxvi className="ml-2" />}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {format(new Date(s.data_horario), "HH:mm", { locale: ptBR })} • {s.local}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(passados?.length ?? 0) > 0 && (
          <div className="card-premium p-5">
            <p className="text-xs uppercase tracking-widest text-gold">Babas passados</p>
            <ul className="mt-3 space-y-2">
              {(passados ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-3 opacity-80"
                >
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-muted-foreground">
                      {format(new Date(s.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{s.local}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mobile: acesso à tela dedicada de todas as cartinhas */}
      <Link to="/cartinhas" className="md:hidden">
        <Button variant="goldOutline" size="lg" className="w-full">
          <Sparkles className="size-4" /> Ver todas as cartinhas
        </Button>
      </Link>

      {/* Ranking mensal (coluna central, abaixo do conteúdo) */}
      <div className="md:col-start-2">
        <RankingMensal />
      </div>

      {/* Lateral direita (desktop): ranking por categoria fixo */}
      <aside className="hidden md:col-start-3 md:row-start-1 md:self-start md:sticky md:top-4 md:block">
        <RankingCartinhas />
      </aside>
    </div>
  );
}

function ListaStatus({
  abertura,
  fechamento,
  fechadaPelaDiretoria,
}: {
  abertura: Date | null;
  fechamento: Date | null;
  fechadaPelaDiretoria: boolean;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const modo = modoLista(agora, abertura, fechamento, fechadaPelaDiretoria);
  const alvo = modo === "abre" ? abertura!.getTime() : fechamento!.getTime();
  const diff = Math.max(0, alvo - agora);
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const restante = `${h}h ${m}m ${s}s`;

  const conf = {
    abre: {
      titulo: "A lista ainda não abriu",
      detalhe: `Abre em ${restante}`,
      icone: <Hourglass className="size-6" />,
      classes: "bg-gold/10 text-gold",
    },
    fecha: {
      titulo: "Lista aberta",
      detalhe: `Fecha em ${restante}`,
      icone: <Clock className="size-6" />,
      classes: "bg-success/15 text-success",
    },
    encerrada: {
      titulo: "Lista encerrada",
      detalhe: "A lista já fechou — fale com a diretoria.",
      icone: <Lock className="size-6" />,
      classes: "bg-destructive/10 text-destructive",
    },
    diretoria: {
      titulo: "Lista fechada pela diretoria",
      detalhe: "Fale com a diretoria para entrar.",
      icone: <Lock className="size-6" />,
      classes: "bg-destructive/10 text-destructive",
    },
  }[modo];

  return (
    <div
      className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${conf.classes} border-current/30`}
    >
      <span className="shrink-0">{conf.icone}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide">{conf.titulo}</p>
        <p className="text-xs font-semibold tabular-nums opacity-90">{conf.detalhe}</p>
      </div>
    </div>
  );
}

/** Card especial do BAxVI — destaca o clássico na home, bem diferente de um baba comum. */
function CardBavi({
  sessao,
  abertura,
  fechamento,
}: {
  sessao: { id: string; data_horario: string; local: string; tipo: string; esta_fechado: boolean };
  abertura: Date | null;
  fechamento: Date | null;
}) {
  const { data: relacionados } = useQuery(baviRelacionadosQuery(sessao.id));
  const { data: perfis } = useQuery(perfisPublicosQuery());
  const nomes = new Map((perfis ?? []).map((p) => [p.id as string, p.nome as string]));

  const bahia = (relacionados ?? []).filter((r) => r.time_nome === "bahia");
  const vitoria = (relacionados ?? []).filter((r) => r.time_nome === "vitoria");
  const nomesBahia = bahia.map((r) => nomes.get(r.usuario_id) ?? "Jogador");
  const nomesVitoria = vitoria.map((r) => nomes.get(r.usuario_id) ?? "Jogador");

  return (
    <Link to="/baba">
      <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-[#1c1233] via-[#0e0a1c] to-[#1c1233] p-5 shadow-[0_0_36px_rgba(201,162,39,0.18)] transition-colors hover:border-gold/70">
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-gold/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 size-32 rounded-full bg-blue-600/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
              <Swords className="size-3.5" /> Evento especial
            </span>
            <Flame className="size-5 text-gold" />
          </div>

          <h2 className="mt-3 font-display text-3xl leading-tight text-foreground">
            ⚔️ Bahia <span className="text-muted-foreground">×</span> Vitória
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O Clássico Cajazeiras. Vale mais que um baba comum — escalação fechada pela diretoria.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <TimeMini cor="bahia" nome="Bahia" jogadores={nomesBahia} />
            <TimeMini cor="vitoria" nome="Vitória" jogadores={nomesVitoria} />
          </div>

          <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-gold" />
              <span>
                {format(new Date(sessao.data_horario), "EEEE, dd 'de' MMMM 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-gold" />
              <span>{sessao.local}</span>
            </div>
            {abertura && fechamento && (
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-gold" />
                <span>
                  Abre {format(abertura, "dd/MM 'às' HH:mm", { locale: ptBR })} · Fecha{" "}
                  {format(fechamento, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-1 text-sm font-semibold text-gold">
            Ver o clássico <ArrowRight className="size-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Miniatura de um time dentro do card do BAxVI. */
function TimeMini({
  cor,
  nome,
  jogadores,
}: {
  cor: "bahia" | "vitoria";
  nome: string;
  jogadores: string[];
}) {
  const visiveis = jogadores.slice(0, 5);
  const extras = Math.max(0, jogadores.length - visiveis.length);
  return (
    <div
      className={`rounded-xl border p-3 ${
        cor === "bahia" ? "border-blue-500/30 bg-blue-500/5" : "border-red-500/30 bg-red-500/5"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {cor === "bahia" ? "🔵" : "🔴"} {nome}
        <span className="ml-1 text-gold">{jogadores.length}</span>
      </p>
      {jogadores.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground/60">Escalação a definir</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {visiveis.map((n, i) => (
            <li key={`${n}-${i}`} className="truncate text-xs text-foreground/90">
              {n}
            </li>
          ))}
          {extras > 0 && <li className="text-[11px] text-muted-foreground">+{extras} jogadores</li>}
        </ul>
      )}
    </div>
  );
}
