import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  perfilAtualQuery,
  minhasMensalidadesQuery,
  situacaoFinanceiraQuery,
  VALOR_MENSALIDADE_PADRAO,
} from "@/lib/babaQueries";
import { tempoDeAssociado } from "@/lib/associado";
import { formatarReais } from "@/lib/redeSocial";
import {
  criarPixMensalidade,
  consultarPixMensalidade,
  criarPixRegularizacao,
  consultarPixRegularizacao,
} from "@/lib/pagamentos.functions";
import { PixDialog, type DadosPix } from "@/components/PixDialog";
import { PresentearMensalidade } from "@/components/PresentearMensalidade";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Wallet,
  Heart,
  QrCode,
  MessageCircle,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

const GRUPO_WHATSAPP_URL = "https://chat.whatsapp.com/HtGUdc005Hd9NLqY8Bcg3W";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  head: () => ({
    meta: [
      { title: "Meus Pagamentos — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Acompanhe o histórico de mensalidades do Fut Cajazeiras: meses pagos, pendentes e a data de vencimento, sempre no último dia de cada mês.",
      },
      { property: "og:title", content: "Histórico de Mensalidades — Fut Cajazeiras" },
      {
        property: "og:description",
        content: "Veja mês a mês suas mensalidades pagas e pendentes no Fut Cajazeiras.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const { data: mensalidades, isLoading } = useQuery(minhasMensalidadesQuery(perfilData?.user.id));
  const { data: situacaoFin } = useQuery(situacaoFinanceiraQuery(perfilData?.user.id));
  const qc = useQueryClient();

  const gerarPix = useServerFn(criarPixMensalidade);
  const consultarPix = useServerFn(consultarPixMensalidade);
  const gerarPixRegularizacao = useServerFn(criarPixRegularizacao);
  const checarPixRegularizacao = useServerFn(consultarPixRegularizacao);

  const [pixAberto, setPixAberto] = useState(false);
  const [mensalidadeAtiva, setMensalidadeAtiva] = useState<string | null>(null);
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
  const [pago, setPago] = useState(false);

  // Retomada de vínculo (inadimplência)
  const [regAberto, setRegAberto] = useState(false);
  const [regId, setRegId] = useState<string | null>(null);
  const [regDados, setRegDados] = useState<DadosPix | null>(null);
  const [regPago, setRegPago] = useState(false);

  const cobrar = useMutation({
    mutationFn: async (mensalidadeId: string) => {
      setMensalidadeAtiva(mensalidadeId);
      setDadosPix(null);
      setPago(false);
      setPixAberto(true);
      return await gerarPix({ data: { mensalidadeId } });
    },
    onSuccess: (res) => {
      if (res.pago) {
        setPago(true);
        qc.invalidateQueries({ queryKey: ["mensalidades-minhas"] });
        return;
      }
      setDadosPix({ qrCode: res.qrCode, qrBase64: res.qrBase64, valor: res.valor });
    },
    onError: (e: Error) => {
      setPixAberto(false);
      toast.error("Não foi possível gerar o PIX", { description: e.message });
    },
  });

  const regularizar = useMutation({
    mutationFn: async () => {
      setRegAberto(true);
      setRegDados(null);
      setRegPago(false);
      return await gerarPixRegularizacao();
    },
    onSuccess: (res) => {
      setRegId(res.regularizacaoId);
      if (res.pago) {
        setRegPago(true);
        void qc.invalidateQueries({ queryKey: ["mensalidades-minhas"] });
        void qc.invalidateQueries({ queryKey: ["situacao-financeira"] });
        void qc.invalidateQueries({ queryKey: ["perfil-atual"] });
        return;
      }
      setRegDados({ qrCode: res.qrCode, qrBase64: res.qrBase64, valor: res.valor });
    },
    onError: (e: Error) => {
      setRegAberto(false);
      toast.error("Não foi possível iniciar a regularização", { description: e.message });
    },
  });

  // Polling enquanto o modal está aberto e o pagamento não foi confirmado
  useEffect(() => {
    if (!pixAberto || pago || !mensalidadeAtiva) return;
    const id = setInterval(async () => {
      try {
        const r = await consultarPix({ data: { mensalidadeId: mensalidadeAtiva } });
        if (r.pago) {
          setPago(true);
          qc.invalidateQueries({ queryKey: ["mensalidades-minhas"] });
          qc.invalidateQueries({ queryKey: ["perfil-atual"] });
          qc.invalidateQueries({ queryKey: ["situacao-financeira"] });
          toast.success("Mensalidade paga!");
        }
      } catch {
        /* silencioso: tentamos de novo no próximo ciclo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [pixAberto, pago, mensalidadeAtiva, consultarPix, qc]);

  // Polling da regularização (retomada de vínculo)
  useEffect(() => {
    if (!regAberto || regPago || !regId) return;
    const id = setInterval(async () => {
      try {
        const r = await checarPixRegularizacao({ data: { regularizacaoId: regId } });
        if (r.pago) {
          setRegPago(true);
          void qc.invalidateQueries({ queryKey: ["mensalidades-minhas"] });
          void qc.invalidateQueries({ queryKey: ["situacao-financeira"] });
          void qc.invalidateQueries({ queryKey: ["perfil-atual"] });
          toast.success("Vínculo restabelecido!");
        }
      } catch {
        /* silencioso: tentamos de novo no próximo ciclo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [regAberto, regPago, regId, checarPixRegularizacao, qc]);

  const tempo = tempoDeAssociado(perfilData?.perfil?.criado_em);
  const pagas = (mensalidades ?? []).filter((m) => m.status === "pago").length;
  const pendentes = (mensalidades ?? []).filter((m) => m.status === "pendente").length;
  const emDia = perfilData?.perfil?.status_pagamento === "pago";
  const mostraGrupo = !!perfilData?.isAssociado && (emDia || pagas > 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold">Financeiro</p>
        <h1 className="font-display text-4xl">Meus pagamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A mensalidade vira todo <strong className="text-foreground">último dia do mês</strong>.
        </p>
      </div>

      {mostraGrupo && (
        <div className="card-premium flex items-center gap-3 p-4">
          <MessageCircle className="size-5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg">Você já faz parte do baba!</p>
            <p className="text-xs text-muted-foreground">
              Entre no grupo oficial do Fut Cajazeiras no WhatsApp para acompanhar tudo.
            </p>
          </div>
          <a
            href={GRUPO_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button variant="goldOutline" size="lg">
              <MessageCircle className="size-4" /> Entrar no grupo
            </Button>
          </a>
        </div>
      )}

      {tempo && (
        <div className="card-vip flex items-center gap-3 p-4">
          <Heart className="size-5 shrink-0 text-gold" />
          <p className="text-sm text-muted-foreground">
            Você é do baba há <strong className="text-gold">{tempo.texto}</strong> — {pagas}{" "}
            {pagas === 1 ? "mensalidade paga" : "mensalidades pagas"} nessa caminhada.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card-vip p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pagas</p>
          <p className="font-display text-3xl text-gold">{pagas}</p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pendentes</p>
          <p className="font-display text-3xl text-destructive">{pendentes}</p>
        </div>
      </div>

      <PresentearMensalidade />

      {situacaoFin?.statusConta === "INADIMPLENTE" && !situacaoFin.ehDiretoria && (
        <div className="card-premium space-y-3 border border-destructive/40 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-display text-lg text-destructive">
                Associação suspensa por inadimplência
              </p>
              <p className="text-xs text-muted-foreground">
                Sua mensalidade está em aberto há mais de um mês. Para retomar os direitos de
                associação, quite os débitos abaixo e a nova Taxa de Associação.
              </p>
            </div>
          </div>

          <ul className="space-y-1.5">
            {situacaoFin.mensalidades.map((m) => (
              <li key={m.mensalidadeId} className="flex items-center justify-between gap-2 text-xs">
                <span className="capitalize text-muted-foreground">
                  {format(new Date(`${m.referencia}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                  {m.atrasada && <span className="text-destructive"> • atrasada</span>}
                </span>
                <span className="shrink-0 text-foreground">
                  {formatarReais(m.valor)}
                  {m.multa > 0 && (
                    <span className="text-destructive"> + {formatarReais(m.multa)}</span>
                  )}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 border-t border-border/60 pt-1.5 text-xs">
              <span className="text-muted-foreground">Taxa de Associação (reinscrição)</span>
              <span className="shrink-0 text-foreground">
                {formatarReais(situacaoFin.taxaAssociacao)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span>Total para retomar</span>
              <span className="text-gold">{formatarReais(situacaoFin.totalRegularizacao)}</span>
            </li>
          </ul>

          <Button
            variant="hero"
            size="lg"
            className="w-full"
            disabled={regularizar.isPending}
            onClick={() => regularizar.mutate()}
          >
            <RefreshCw className="size-4" /> Retomar vínculo —{" "}
            {formatarReais(situacaoFin.totalRegularizacao)}
          </Button>

          {!situacaoFin.financeiroAutomatico && (
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Sua situação está sendo acompanhada manualmente pela diretoria.
            </p>
          )}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}

      <ul className="space-y-2">
        {(mensalidades ?? []).map((m) => {
          const pago = m.status === "pago";
          const multa = Number(m.multa_valor ?? 0);
          const base = Number(m.valor || VALOR_MENSALIDADE_PADRAO);
          const total = base + multa;
          const atrasado = !pago && new Date(m.vencimento) < new Date();
          return (
            <li key={m.id} className="card-premium flex flex-wrap items-center gap-3 p-4">
              <div
                className={`flex size-10 items-center justify-center rounded-full ${pago ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"}`}
              >
                {pago ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl capitalize leading-none">
                  {format(new Date(`${m.referencia}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3" />
                  Vence em {format(new Date(`${m.vencimento}T12:00:00`), "dd/MM/yyyy")}
                  {pago && m.pago_em && ` • pago em ${format(new Date(m.pago_em), "dd/MM")}`}
                </p>
                {!pago && multa > 0 && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Multa por atraso: {formatarReais(multa)} (inclusa no PIX)
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                  pago
                    ? "bg-gold/10 text-gold"
                    : atrasado
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {pago ? "Pago" : atrasado ? "Atrasado" : "Em aberto"}
              </span>
              {!pago && (
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={cobrar.isPending}
                  onClick={() => cobrar.mutate(m.id)}
                >
                  <QrCode className="size-4" /> Pagar com PIX — {formatarReais(total)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {!isLoading && (mensalidades ?? []).length === 0 && (
        <div className="card-premium p-6 text-center">
          <Wallet className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 font-display text-xl">Sem lançamentos ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que a diretoria abrir o mês, ele aparece aqui.
          </p>
        </div>
      )}

      <PixDialog
        open={pixAberto}
        onOpenChange={setPixAberto}
        titulo="Pagar mensalidade"
        descricao="Escaneie o QR Code ou copie o código no app do seu banco."
        dados={dadosPix}
        carregando={cobrar.isPending}
        pago={pago}
      />

      <PixDialog
        open={regAberto}
        onOpenChange={setRegAberto}
        titulo="Retomar vínculo"
        descricao="Débitos retroativos + multas + Taxa de Associação em um único PIX."
        dados={regDados}
        carregando={regularizar.isPending}
        pago={regPago}
      />
    </div>
  );
}
