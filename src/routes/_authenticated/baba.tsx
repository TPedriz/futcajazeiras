import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  perfilAtualQuery,
  proximaSessaoQuery,
  presencasDaSessaoQuery,
  situacaoCheckinQuery,
  DIA_VENCIMENTO,
} from "@/lib/babaQueries";
import { Link } from "@tanstack/react-router";
import { MuralPunicoes } from "@/components/MuralPunicoes";
import { ChegadaGps } from "@/components/ChegadaGps";

import { ConviteConvidado } from "@/components/ConviteConvidado";
import { SolicitacoesRecebidas } from "@/components/SolicitacoesRecebidas";
import { LevarConvidado } from "@/components/LevarConvidado";
import { AvatarJogador } from "@/components/AvatarJogador";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, UserPlus, Clock, Check, Shield, HandMetal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/baba")({
  head: ({ loaderData }) => {
    const sessao = loaderData as { id: string; data_horario: string; local: string } | null | undefined;
    const scripts = sessao
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `Baba Fut Cajazeiras — ${new Date(sessao.data_horario).toLocaleDateString("pt-BR")}`,
            startDate: sessao.data_horario,
            sport: "Soccer",
            location: { "@type": "Place", name: sessao.local },
            organizer: { "@type": "SportsOrganization", name: "Fut Cajazeiras" },
          }),
        }]
      : undefined;
    return {
      meta: [
        { title: "Próximo Baba — Fut Cajazeiras" },
        { name: "description", content: "Confirme sua presença, leve seu convidado e veja a lista de chamada do próximo baba do Fut Cajazeiras." },
        { property: "og:title", content: "Próximo Baba — Fut Cajazeiras" },
        { property: "og:description", content: "Data, horário, local e lista de chamada do próximo baba do Fut Cajazeiras." },
        { property: "og:type", content: "event" },
      ],
      ...(scripts ? { scripts } : {}),
    };
  },
  loader: async ({ context }) => {
    return await context.queryClient.ensureQueryData(proximaSessaoQuery());
  },
  component: BabaPage,
});


function BabaPage() {
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const { data: sessao } = useSuspenseQuery(proximaSessaoQuery());
  const { data: presencas } = useQuery(presencasDaSessaoQuery(sessao?.id));
  const { data: situacao } = useQuery(
    situacaoCheckinQuery(perfilData?.user.id, sessao?.id),
  );
  const queryClient = useQueryClient();
  const queryClient = useQueryClient();

  const userId = perfilData?.user.id;
  const isAdmin = perfilData?.isAdmin ?? false;
  const isConvidado = perfilData?.isConvidado ?? false;

  const minhaPresenca = presencas?.find((p) => p.usuario_id === userId && !p.nome_convidado);

  const fechamento = sessao ? fechamentoEfetivo(sessao) : null;
  const listaFechada = sessao?.esta_fechado || (!!fechamento && fechamento <= new Date());


  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["presencas", sessao?.id] });
  };






  const confirmarPresenca = useMutation({
    mutationFn: async () => {
      if (!sessao || !userId) throw new Error("Sessão indisponível");
      const { error } = await supabase.from("presencas").insert({
        baba_id: sessao.id,
        usuario_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presença confirmada!");
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível confirmar", { description: e.message }),
  });

  const cancelarPresenca = useMutation({
    mutationFn: async () => {
      if (!minhaPresenca) return;
      const { error } = await supabase.from("presencas").delete().eq("id", minhaPresenca.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presença cancelada");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro ao cancelar", { description: e.message }),
  });





  const removerPresenca = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("presencas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const moderarConvidado = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "rejeitado" }) => {
      const { error } = await supabase.from("presencas").update({ status_convidado: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "aprovado" ? "Convidado aprovado" : "Convidado rejeitado");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (!sessao) {
    return (
      <div className="card-premium p-8 text-center">
        <Calendar className="mx-auto size-12 text-muted-foreground/50" />
        <p className="mt-4 font-display text-2xl">Nenhum baba agendado</p>
        <p className="mt-1 text-sm text-muted-foreground">Aguarde a diretoria marcar a próxima sessão.</p>
      </div>
    );
  }

  const membros = presencas?.filter((p) => !p.nome_convidado) ?? [];
  const convidados = presencas?.filter((p) => p.nome_convidado) ?? [];

  return (
    <div className="space-y-5">
      {/* Info do baba */}
      <div className="card-premium p-5">
        <p className="text-xs uppercase tracking-widest text-gold">Próximo Baba</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">
          {format(new Date(sessao.data_horario), "EEEE, dd 'de' MMM", { locale: ptBR })}
        </h1>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-gold" />
            {format(new Date(sessao.data_horario), "HH:mm")}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-gold" />
            <span className="truncate">{sessao.local}</span>
          </div>
        </div>
        <ContadorFechamento fechamento={(fechamento ?? new Date()).toISOString()} fechado={sessao.esta_fechado} />
      </div>

      {/* Ações */}
      {listaFechada ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center">
          <p className="font-semibold text-destructive">Lista encerrada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A lista fecha às 22h do dia anterior ou 3 horas antes do jogo — o que vier primeiro.
          </p>

        </div>
      ) : situacao?.suspenso ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center">
          <p className="font-semibold text-destructive">Você está suspenso neste baba</p>
          <p className="mt-1 text-xs text-muted-foreground">{situacao.motivoSuspensao}</p>
        </div>
      ) : situacao?.inadimplente ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center">
          <p className="font-semibold text-destructive">Mensalidade em aberto</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O vencimento é todo dia {DIA_VENCIMENTO}. Pague o PIX para liberar o check-in e os convidados
            — a liberação é automática.
          </p>
          <Link to="/pagamentos">
            <Button variant="gold" size="sm" className="mt-3">
              Pagar mensalidade
            </Button>
          </Link>
        </div>
      ) : isConvidado ? (
        <ConviteConvidado babaId={sessao.id} userId={userId!} />
      ) : minhaPresenca ? (
        <div className="card-vip p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-success/20">
              <Check className="size-6 text-success" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg text-foreground">Presença confirmada!</p>
              <p className="text-xs text-muted-foreground">Você está na lista.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => cancelarPresenca.mutate()}
            disabled={cancelarPresenca.isPending}
          >
            Cancelar presença
          </Button>
        </div>
      ) : (
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          onClick={() => confirmarPresenca.mutate()}
          disabled={confirmarPresenca.isPending}
        >
          Confirmar minha presença
        </Button>
      )}

      {!listaFechada && !isConvidado && userId && (
        <SolicitacoesRecebidas babaId={sessao.id} userId={userId} />
      )}

      {/* Convidado */}
      {!listaFechada && !isConvidado && userId && (
        <LevarConvidado babaId={sessao.id} userId={userId} />
      )}


      {/* Lista de chamada */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Lista de chamada</h2>
          <Badge variant="outline" className="border-gold/40 text-gold">
            {membros.length} + {convidados.filter((c) => c.status_convidado === "aprovado").length}
          </Badge>
        </div>

        {presencas?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém confirmou ainda. Seja o primeiro!</p>
        ) : (
          <ul className="space-y-2">
            {membros.map((p, idx) => (
              <PresencaCard
                key={p.id}
                numero={idx + 1}
                nome={p.perfis?.nome ?? "Associado"}
                avatar={p.perfis?.avatar_url}
                posicao={p.perfis?.posicao ?? "linha"}
                tipo="membro"
                onRemove={isAdmin ? () => removerPresenca.mutate(p.id) : undefined}
              />
            ))}

            {convidados.map((p) => (
              <PresencaCard
                key={p.id}
                nome={p.nome_convidado!}
                tipo="convidado"
                statusConvidado={p.status_convidado ?? undefined}
                mpStatus={p.mp_status}
                onApprove={isAdmin && p.status_convidado === "pendente" ? () => moderarConvidado.mutate({ id: p.id, status: "aprovado" }) : undefined}
                onReject={isAdmin && p.status_convidado === "pendente" ? () => moderarConvidado.mutate({ id: p.id, status: "rejeitado" }) : undefined}
                onRemove={isAdmin ? () => removerPresenca.mutate(p.id) : undefined}
              />
            ))}
          </ul>
        )}
      </div>

      <ChegadaGps
        sessao={sessao}
        presencas={presencas ?? []}
        minhaPresencaId={minhaPresenca?.id}
        jaChegou={!!minhaPresenca?.ordem_chegada}
        isAdmin={isAdmin}
      />

      <MuralPunicoes />

    </div>
  );
}

function ContadorFechamento({ fechamento, fechado }: { fechamento: string; fechado: boolean }) {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    const t = new Date(fechamento).getTime();
    const upd = () => {
      const d = t - Date.now();
      if (d <= 0) return setTxt("encerrada");
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d / 60000) % 60);
      setTxt(`${h}h ${m}m`);
    };
    upd();
    const id = setInterval(upd, 30000);
    return () => clearInterval(id);
  }, [fechamento]);

  const off = fechado || txt === "encerrada";
  return (
    <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-widest ${off ? "bg-destructive/10 text-destructive" : "bg-gold/10 text-gold"}`}>
      <Clock className="size-4" />
      {off ? "Lista encerrada" : `Fecha em ${txt}`}
    </div>
  );
}

function StatusConvidadoBadge({ status, mpStatus }: { status: string; mpStatus?: string | null }) {
  if (status === "aprovado") return <Badge className="mt-1 bg-success text-success-foreground">Confirmado</Badge>;
  if (status === "rejeitado") return <Badge variant="destructive" className="mt-1">Rejeitado</Badge>;
  if (mpStatus === "rejected" || mpStatus === "cancelled")
    return <Badge variant="destructive" className="mt-1">Pagamento não concluído</Badge>;
  return <Badge variant="outline" className="mt-1 border-gold/40 text-gold">Aguardando pagamento</Badge>;
}

interface PresencaCardProps {
  numero?: number;
  nome: string;
  avatar?: string | null;
  posicao?: "linha" | "goleiro";
  tipo: "membro" | "convidado";
  statusConvidado?: string;
  mpStatus?: string | null;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
}

function PresencaCard({ numero, nome, avatar, posicao, tipo, statusConvidado, mpStatus, onApprove, onReject, onRemove }: PresencaCardProps) {
  const isConvidado = tipo === "convidado";
  const pendente = isConvidado && statusConvidado === "pendente";
  const aguardandoPix = pendente && mpStatus !== "approved";


  return (
    <li className={`flex items-center gap-3 rounded-lg border p-3 ${
      isConvidado ? (statusConvidado === "aprovado" ? "border-success/30 bg-success/5" : statusConvidado === "rejeitado" ? "border-destructive/30 bg-destructive/5 opacity-60" : "border-border bg-surface") : "border-gold/20 bg-surface"
    }`}>
      {numero && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/10 font-display text-sm text-gold">
          {numero}
        </div>
      )}
      <AvatarJogador caminho={avatar} nome={nome} size="sm" />

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {isConvidado ? (
            <>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Convidado</span>
              {aguardandoPix && <span className="text-[10px] text-gold">• aguardando pagamento</span>}
              {statusConvidado === "rejeitado" && <span className="text-[10px] text-destructive">• rejeitado</span>}
            </>
          ) : posicao === "goleiro" ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <HandMetal className="size-3" /> Goleiro
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-gold">
              <Shield className="size-3" /> Associado
            </span>
          )}
        </div>
      </div>
      {pendente && onApprove && (
        <>
          <Button variant="success" size="icon" className="size-9" onClick={onApprove} aria-label="Aprovar convidado">
            <Check className="size-4" />
          </Button>
          <Button variant="destructive" size="icon" className="size-9" onClick={onReject} aria-label="Rejeitar convidado">
            <X className="size-4" />
          </Button>
        </>
      )}
      {!pendente && onRemove && (
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" onClick={onRemove} aria-label="Remover da lista">
          <X className="size-4" />
        </Button>
      )}

    </li>
  );
}
