import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  perfilAtualQuery,
  proximaSessaoQuery,
  proximasSessoesQuery,
  sessoesPassadasQuery,
  presencasDaSessaoQuery,
  fechamentoEfetivo,
  aberturaEfetivo,
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { RankingMensal } from "@/components/RankingMensal";
import { tempoDeAssociado } from "@/lib/associado";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const proximas = (proximasBruto ?? []).filter((s) => s.id !== proxSessao?.id);

  const nome = perfilData?.perfil?.nome ?? "Atleta";
  const emDia = perfilData?.perfil?.status_pagamento === "pago";
  const totalConfirmados = presencas?.filter((p) => !p.nome_convidado).length ?? 0;
  const tempo = tempoDeAssociado(perfilData?.perfil?.criado_em);

  const abertura = proxSessao ? aberturaEfetivo(proxSessao) : null;
  const fechamento = proxSessao ? fechamentoEfetivo(proxSessao) : null;
  const listaAberta =
    modoLista(Date.now(), abertura, fechamento, !!proxSessao?.esta_fechado) === "fecha";

  return (
    <div className="space-y-5">
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
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Mensalidade</p>
            <p className={`mt-1 font-display text-3xl ${emDia ? "text-gold" : "text-destructive"}`}>
              {emDia ? "Em dia" : "Pendente"}
            </p>
          </div>
          <div
            className={`flex size-14 items-center justify-center rounded-full ${emDia ? "bg-gold/10" : "bg-destructive/10"}`}
          >
            {emDia ? (
              <CheckCircle2 className="size-7 text-gold" />
            ) : (
              <AlertCircle className="size-7 text-destructive" />
            )}
          </div>
        </div>
        {!emDia && (
          <p className="mt-3 text-sm text-muted-foreground">
            Regularize sua mensalidade com a diretoria para manter a prioridade no check-in.
          </p>
        )}
      </div>

      {/* Próximo Baba */}
      {proxSessao ? (
        <Link to="/baba">
          <div className="card-premium p-5 hover:border-gold/40 transition-colors">
            <p className="text-xs uppercase tracking-widest text-gold">Próximo Baba</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">
              {format(new Date(proxSessao.data_horario), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-gold" />
                <span>{format(new Date(proxSessao.data_horario), "HH:mm", { locale: ptBR })}</span>
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
            {listaAberta ? "Confirmar minha presença" : "Ver detalhes do baba"}
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

      {passados.length > 0 && (
        <div className="card-premium p-5">
          <p className="text-xs uppercase tracking-widest text-gold">Babas passados</p>
          <ul className="mt-3 space-y-2">
            {passados.map((s) => (
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

      <RankingMensal />
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
