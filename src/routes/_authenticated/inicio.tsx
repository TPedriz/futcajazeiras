import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { perfilAtualQuery, proximaSessaoQuery, presencasDaSessaoQuery } from "@/lib/babaQueries";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Calendar, MapPin, Users, ArrowRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Fut Cajazeiras" },
      { name: "description", content: "Painel do associado do Fut Cajazeiras: status financeiro e próximo baba." },
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

  const nome = perfilData?.perfil?.nome ?? "Atleta";
  const emDia = perfilData?.perfil?.status_pagamento === "pago";
  const totalConfirmados = presencas?.filter((p) => !p.nome_convidado).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Boa!</p>
        <h1 className="font-display text-4xl leading-tight text-foreground">{nome.split(" ")[0]}</h1>
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
          <div className={`flex size-14 items-center justify-center rounded-full ${emDia ? "bg-gold/10" : "bg-destructive/10"}`}>
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
            </div>
            <ContadorRegressivo fechamento={proxSessao.fechamento_lista} />
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
            Confirmar minha presença
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ContadorRegressivo({ fechamento }: { fechamento: string }) {
  const [restante, setRestante] = useState<string>("");
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    const alvo = new Date(fechamento).getTime();
    const atualizar = () => {
      const diff = alvo - Date.now();
      if (diff <= 0) {
        setFechado(true);
        setRestante("Lista fechada");
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setRestante(`${h}h ${m}m ${s}s`);
    };
    atualizar();
    const id = setInterval(atualizar, 1000);
    return () => clearInterval(id);
  }, [fechamento]);

  return (
    <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 ${fechado ? "bg-destructive/10 text-destructive" : "bg-gold/10 text-gold"}`}>
      <Clock className="size-4" />
      <span className="text-xs font-semibold uppercase tracking-widest">
        {fechado ? "Lista encerrada" : `Fecha em ${restante}`}
      </span>
    </div>
  );
}
