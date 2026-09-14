import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  todosAssociadosQuery,
  mensalidadesDoMesQuery,
  mensalidadesPendentesTodasQuery,
  mesReferencia,
  papeisTodosQuery,
  valorMensalidadeQuery,
  valorConvidadoQuery,
  valorMultaAtrasoQuery,
  valorTaxaAssociacaoQuery,
  taxasPagamentoQuery,
  vagasAssociadosQuery,
  LIMITE_ASSOCIADOS,
  VALOR_MENSALIDADE_PADRAO,
  VALOR_CONVIDADO_PADRAO,
  VALOR_MULTA_ATRASO_PADRAO,
} from "@/lib/babaQueries";
import {
  CHAVES_TAXA,
  METODOS_PAGAMENTO,
  ROTULO_METODO,
  TAXAS_PADRAO,
  calcularCobranca,
  type MetodoPagamento,
} from "@/lib/taxasPagamento";
import {
  formatarCobrancaInadimplentesParaWhatsApp,
  totalCobranca,
  type InadimplenteCobranca,
} from "@/lib/cobrancaInadimplentes";
import { formatarReais } from "@/lib/redeSocial";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FiltroCargo, type FiltroPapel } from "@/components/FiltroCargo";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  HandMetal,
  User,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coins,
  Users,
  UserPlus,
  ShieldAlert,
  ShieldOff,
  UserCheck,
  RotateCcw,
  RefreshCw,
  Copy,
  Send,
  CreditCard,
} from "lucide-react";
import { useEffect, useState } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: FinanceiroPage,
});

type FiltroStatus = "todos" | "pago" | "pendente" | "inadimplente";

const FILTROS_STATUS = [
  { id: "todos", rotulo: "Todos" },
  { id: "pago", rotulo: "Pagos" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "inadimplente", rotulo: "Inadimplentes" },
] as const satisfies readonly { id: FiltroStatus; rotulo: string }[];

function FinanceiroPage() {
  const { data: todos } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const { data: totalAssociados } = useQuery(vagasAssociadosQuery());
  const [refDate, setRefDate] = useState(() => new Date(`${mesReferencia()}T12:00:00`));
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("todos");
  const referencia = mesReferencia(refDate);
  const { data: mensalidades } = useQuery(mensalidadesDoMesQuery(referencia));
  const { data: pendentesTodas } = useQuery(mensalidadesPendentesTodasQuery());
  const qc = useQueryClient();

  const papelDe = (id: string) => {
    const meus = (papeis ?? []).filter((p) => p.user_id === id).map((p) => p.papel);
    if (meus.includes("administrador")) return "administrador";
    if (meus.includes("associado")) return "associado";
    return "convidado";
  };
  const porUsuario = new Map((mensalidades ?? []).map((m) => [m.usuario_id, m]));

  // Débitos acumulados (todos os meses em aberto + multas) por associado.
  const dividas = new Map<string, { meses: number; total: number }>();
  for (const m of pendentesTodas ?? []) {
    const atual = dividas.get(m.usuario_id) ?? { meses: 0, total: 0 };
    atual.meses += 1;
    atual.total += Number(m.valor) + Number(m.multa_valor ?? 0);
    dividas.set(m.usuario_id, atual);
  }

  const associados = todos.filter((a) => filtro === "todos" || papelDe(a.id) === filtro);
  const ehInadimplente = (a: (typeof associados)[number]) => a.status_conta === "INADIMPLENTE";
  const visiveis = associados.filter((a) => {
    if (statusFiltro === "todos") return true;
    if (statusFiltro === "inadimplente") return ehInadimplente(a);
    const ok = porUsuario.get(a.id)?.status === "pago";
    return statusFiltro === "pago" ? ok : !ok;
  });

  const emDia = associados.filter((a) => porUsuario.get(a.id)?.status === "pago").length;
  const inadimplentes = associados.filter(ehInadimplente);
  const totalSuspensos = inadimplentes.reduce(
    (soma, a) => soma + (dividas.get(a.id)?.total ?? 0),
    0,
  );

  // Lista de cobrança (nomes + valores) — sempre com TODOS os inadimplentes,
  // independente dos filtros da tela, para montar o texto do WhatsApp.
  const cobranca: InadimplenteCobranca[] = todos
    .filter((a) => ehInadimplente(a))
    .map((a) => ({
      nome: a.nome,
      mensalidades: (pendentesTodas ?? [])
        .filter((m) => m.usuario_id === a.id)
        .map((m) => ({
          referencia: m.referencia,
          valor: Number(m.valor),
          multa: Number(m.multa_valor ?? 0),
        })),
    }))
    .filter((c) => c.mensalidades.length > 0);
  const contagens: Record<FiltroStatus, number> = {
    todos: associados.length,
    pago: emDia,
    pendente: associados.length - emDia,
    inadimplente: inadimplentes.length,
  };
  const ultimoDia = format(
    new Date(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)),
    "dd/MM/yyyy",
  );

  const alterar = useMutation({
    mutationFn: async ({
      usuarioId,
      status,
    }: {
      usuarioId: string;
      status: "pago" | "pendente";
    }) => {
      const existente = porUsuario.get(usuarioId);
      if (existente) {
        const { error } = await supabase
          .from("mensalidades")
          .update({ status, pago_em: status === "pago" ? new Date().toISOString() : null })
          .eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mensalidades")
          .insert({ usuario_id: usuarioId, referencia, vencimento: referencia, status });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mensalidade atualizada");
      qc.invalidateQueries({ queryKey: ["mensalidades-mes", referencia] });
      qc.invalidateQueries({ queryKey: ["mensalidades-pendentes-todas"] });
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  // Ações manuais da diretoria: suspendem/rebaixam, reativam ou devolvem ao automático.
  const definirSituacao = useMutation({
    mutationFn: async ({
      usuarioId,
      acao,
    }: {
      usuarioId: string;
      acao: "suspender" | "reativar" | "automatico";
    }) => {
      const { error } = await supabase.rpc("admin_definir_situacao_associado", {
        p_usuario_id: usuarioId,
        p_acao: acao,
      });
      if (error) throw error;
      return acao;
    },
    onSuccess: (acao) => {
      toast.success(
        acao === "suspender"
          ? "Suspenso e rebaixado para convidado"
          : acao === "reativar"
            ? "Associado reativado"
            : "Caso devolvido ao modo automático",
        acao === "automatico"
          ? undefined
          : { description: "A situação fica sob controle manual da diretoria." },
      );
      void qc.invalidateQueries({ queryKey: ["associados-todos"] });
      void qc.invalidateQueries({ queryKey: ["papeis-todos"] });
      void qc.invalidateQueries({ queryKey: ["mensalidades-pendentes-todas"] });
      void qc.invalidateQueries({ queryKey: ["mensalidades-mes"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível alterar a situação", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="card-premium flex items-center justify-between p-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          onClick={() => setRefDate((d) => addMonths(d, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="font-display text-xl capitalize">
            {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <CalendarClock className="size-3" /> vence em {ultimoDia}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          onClick={() => setRefDate((d) => addMonths(d, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-vip p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Em dia</p>
          <p className="font-display text-3xl text-gold">{emDia}</p>
        </div>
        <div className="card-premium p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pendentes</p>
          <p className="font-display text-3xl text-destructive">{associados.length - emDia}</p>
        </div>
      </div>

      {contagens.inadimplente > 0 && (
        <button
          type="button"
          onClick={() =>
            setStatusFiltro((atual) => (atual === "inadimplente" ? "todos" : "inadimplente"))
          }
          aria-pressed={statusFiltro === "inadimplente"}
          className={cn(
            "card-premium flex w-full items-center gap-2 border border-destructive/40 p-3 text-left transition-colors hover:bg-destructive/5",
            statusFiltro === "inadimplente" && "bg-destructive/10",
          )}
        >
          <ShieldAlert className="size-4 shrink-0 text-destructive" />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            <strong className="text-destructive">{contagens.inadimplente}</strong> suspenso(s) por
            inadimplência ·{" "}
            <strong className="text-foreground">{formatarReais(totalSuspensos)}</strong> em aberto.
            <span className="ml-1 text-destructive/80">
              {statusFiltro === "inadimplente" ? "Toque para limpar." : "Toque para filtrar."}
            </span>
          </p>
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              statusFiltro === "inadimplente" && "rotate-90",
            )}
          />
        </button>
      )}

      {cobranca.length > 0 && <ExportarInadimplentesWhatsApp lista={cobranca} />}

      <div className="card-premium p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
            <Users className="size-4" /> Associados cadastrados
          </p>
          <p className="font-display text-lg">
            <span className="text-gold">{totalAssociados ?? 0}</span>
            <span className="text-muted-foreground">/{LIMITE_ASSOCIADOS}</span>
          </p>
        </div>
        <Progress
          value={Math.min(100, ((totalAssociados ?? 0) / LIMITE_ASSOCIADOS) * 100)}
          className="mt-2 h-2"
        />
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <UserPlus className="size-3" />
          {LIMITE_ASSOCIADOS - (totalAssociados ?? 0)} vaga(s) livre(s) para novos associados
        </p>
      </div>

      <FiltroCargo valor={filtro} onChange={setFiltro} total={associados.length} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTROS_STATUS.map(({ id, rotulo }) => (
          <Button
            key={id}
            variant={statusFiltro === id ? "gold" : "outline"}
            size="sm"
            className="flex-col gap-0 py-2 leading-tight"
            aria-pressed={statusFiltro === id}
            onClick={() => setStatusFiltro(id)}
          >
            <span className="text-[11px]">{rotulo}</span>
            <span className="text-[10px] font-normal opacity-80">{contagens[id]}</span>
          </Button>
        ))}
      </div>

      <ValorMensalidadeCard />
      <ValorConvidadoCard />
      <ValorMultaCard />
      <ValorTaxaAssociacaoCard />
      <TaxasPagamentoCard />
      <RotinaFinanceiraCard />

      <ul className="space-y-2">
        {visiveis.map((a) => {
          const ok = porUsuario.get(a.id)?.status === "pago";
          const divida = dividas.get(a.id);
          const papel = papelDe(a.id);
          const ehDiretoriaLinha = papel === "administrador";
          const manual = a.financeiro_automatico === false;
          return (
            <li
              key={a.id}
              className={cn(
                "card-premium flex flex-wrap items-center gap-3 p-3",
                ehInadimplente(a) && "border-destructive/40",
              )}
            >
              <div
                className={`flex size-9 items-center justify-center rounded-full ${ok ? "bg-gold/10 text-gold" : "bg-destructive/10 text-destructive"}`}
              >
                {a.posicao === "goleiro" ? (
                  <HandMetal className="size-4" />
                ) : (
                  <User className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {a.nome}
                  {ehInadimplente(a) && (
                    <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-widest text-destructive">
                      Inadimplente
                    </span>
                  )}
                  {manual && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Gestão manual
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {a.telefone || a.email}
                </p>
                {divida && divida.meses > 0 && (
                  <p className="truncate text-[11px] text-destructive">
                    {divida.meses} {divida.meses === 1 ? "mês" : "meses"} em aberto •{" "}
                    {formatarReais(divida.total)}
                  </p>
                )}
              </div>
              <Button
                variant={ok ? "goldOutline" : "success"}
                size="sm"
                disabled={alterar.isPending}
                onClick={() =>
                  alterar.mutate({ usuarioId: a.id, status: ok ? "pendente" : "pago" })
                }
              >
                {ok ? (
                  <>
                    <AlertCircle className="size-3" /> Pendente
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" /> Pago
                  </>
                )}
              </Button>

              {!ehDiretoriaLinha && (
                <div className="flex w-full flex-wrap items-center gap-2">
                  {ehInadimplente(a) ? (
                    <Button
                      variant="goldOutline"
                      size="sm"
                      disabled={definirSituacao.isPending}
                      title="Devolve o cargo de associado e marca a conta como ativa"
                      onClick={() => definirSituacao.mutate({ usuarioId: a.id, acao: "reativar" })}
                    >
                      <UserCheck className="size-3" /> Reativar (associado)
                    </Button>
                  ) : papel === "associado" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={definirSituacao.isPending}
                      title="Marca como inadimplente e rebaixa para convidado"
                      onClick={() => definirSituacao.mutate({ usuarioId: a.id, acao: "suspender" })}
                    >
                      <ShieldOff className="size-3" /> Suspender (rebaixar)
                    </Button>
                  ) : null}

                  {manual && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={definirSituacao.isPending}
                      title="Devolve o caso ao motor automático de multas e suspensão"
                      onClick={() =>
                        definirSituacao.mutate({ usuarioId: a.id, acao: "automatico" })
                      }
                    >
                      <RotateCcw className="size-3" /> Voltar ao automático
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {visiveis.length === 0 && (
        <div className="card-premium p-6 text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 font-display text-lg">Nenhum associado neste filtro</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {statusFiltro === "inadimplente"
              ? "Ninguém com a associação suspensa por inadimplência."
              : "Ajuste o cargo ou o status para ver outros associados."}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Exporta a lista de inadimplentes (nome + valor devido) para o WhatsApp, com
 * a legenda explicando a cobrança: mensalidades atrasadas + multa por mês.
 */
function ExportarInadimplentesWhatsApp({ lista }: { lista: InadimplenteCobranca[] }) {
  const { data: valorMensalidade } = useQuery(valorMensalidadeQuery());
  const { data: valorMulta } = useQuery(valorMultaAtrasoQuery());
  const { data: valorTaxa } = useQuery(valorTaxaAssociacaoQuery());
  const [copiado, setCopiado] = useState(false);

  const montarTexto = () =>
    formatarCobrancaInadimplentesParaWhatsApp(lista, {
      valorMensalidade,
      valorMulta,
      valorTaxaAssociacao: valorTaxa,
    });

  const total = totalCobranca(lista, valorTaxa);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(montarTexto());
      setCopiado(true);
      toast.success("Lista copiada! Cole no grupo do WhatsApp.", {
        description: `${lista.length} inadimplente(s) • ${formatarReais(total)}`,
      });
    } catch {
      toast.error("Não foi possível copiar", { description: "Selecione o texto manualmente." });
    }
  };

  const enviar = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(montarTexto())}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="card-premium space-y-2 border border-destructive/40 p-3">
      <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-destructive">
        <Send className="size-4" /> Cobrança no WhatsApp
      </p>
      <p className="text-[11px] text-muted-foreground">
        Gera a lista com o <strong className="text-foreground">nome</strong> e o{" "}
        <strong className="text-foreground">valor devido</strong> de cada inadimplente, com a
        legenda explicando a cobrança: mensalidades atrasadas + multa por mês de atraso + Taxa de
        Associação (reinscrição).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="goldOutline" size="sm" onClick={() => void copiar()}>
          <Copy className="size-3" /> {copiado ? "Copiar de novo" : "Copiar lista"}
        </Button>
        <Button variant="outline" size="sm" onClick={enviar}>
          <Send className="size-3" /> Enviar no WhatsApp
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {lista.length} inadimplente(s) • {formatarReais(total)}
        </span>
      </div>
    </div>
  );
}

/** Reajuste do valor da mensalidade, com dupla confirmação. */
function ValorMensalidadeCard() {
  const qc = useQueryClient();
  const { data: valorAtual } = useQuery(valorMensalidadeQuery());
  const [novo, setNovo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = Number(novo.replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0)
        throw new Error("Informe um valor válido em reais.");
      const { error } = await supabase
        .from("configuracoes")
        .upsert(
          { chave: "valor_mensalidade", valor, atualizado_em: new Date().toISOString() },
          { onConflict: "chave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valor da mensalidade atualizado", {
        description: "Mensalidades em aberto e novas cobranças já usam o novo valor.",
      });
      setConfirmando(false);
      setNovo("");
      qc.invalidateQueries({ queryKey: ["valor-mensalidade"] });
      qc.invalidateQueries({ queryKey: ["mensalidades-mes"] });
      qc.invalidateQueries({ queryKey: ["mensalidades-minhas"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const formatado = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Coins className="size-4 text-gold" />
        <p className="text-xs uppercase tracking-widest text-gold">Valor da mensalidade</p>
      </div>
      <p className="font-display text-3xl text-gold">
        {formatado(Number(valorAtual ?? VALOR_MENSALIDADE_PADRAO))}
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          placeholder="Novo valor (ex.: 25)"
          aria-label="Novo valor da mensalidade"
          value={novo}
          className="h-11"
          onChange={(e) => {
            setNovo(e.target.value);
            setConfirmando(false);
          }}
        />
        <Button
          variant={confirmando ? "destructive" : "gold"}
          size="lg"
          disabled={!novo || salvar.isPending}
          onClick={() => (confirmando ? salvar.mutate() : setConfirmando(true))}
        >
          {confirmando ? "Confirmar" : "Alterar"}
        </Button>
      </div>
      {confirmando && (
        <p className="text-[11px] text-destructive">
          Confirme novamente: a mensalidade passará a ser cobrada por {novo.replace(".", ",")} reais
          para todos os associados. Toque em “Confirmar” para aplicar.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        O reajuste atualiza na hora todas as mensalidades ainda em aberto e as novas cobranças.
        Mensalidades já pagas mantêm o valor pago.
      </p>
    </div>
  );
}

/** Reajuste do valor da diária de convidado, com dupla confirmação. */
function ValorConvidadoCard() {
  const qc = useQueryClient();
  const { data: valorAtual } = useQuery(valorConvidadoQuery());
  const [novo, setNovo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = Number(novo.replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0)
        throw new Error("Informe um valor válido em reais.");
      const { error } = await supabase
        .from("configuracoes")
        .upsert(
          { chave: "valor_convidado", valor, atualizado_em: new Date().toISOString() },
          { onConflict: "chave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valor da diária de convidado atualizado", {
        description: "Os próximos PIX de convidado já usam o novo valor.",
      });
      setConfirmando(false);
      setNovo("");
      qc.invalidateQueries({ queryKey: ["valor-convidado"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const formatado = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-gold" />
        <p className="text-xs uppercase tracking-widest text-gold">Valor da diária de convidado</p>
      </div>
      <p className="font-display text-3xl text-gold">
        {formatado(Number(valorAtual ?? VALOR_CONVIDADO_PADRAO))}
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          placeholder="Novo valor (ex.: 10)"
          aria-label="Novo valor da diária de convidado"
          value={novo}
          className="h-11"
          onChange={(e) => {
            setNovo(e.target.value);
            setConfirmando(false);
          }}
        />
        <Button
          variant={confirmando ? "destructive" : "gold"}
          size="lg"
          disabled={!novo || salvar.isPending}
          onClick={() => (confirmando ? salvar.mutate() : setConfirmando(true))}
        >
          {confirmando ? "Confirmar" : "Alterar"}
        </Button>
      </div>
      {confirmando && (
        <p className="text-[11px] text-destructive">
          Confirme novamente: a diária do convidado passará a ser cobrada por{" "}
          {novo.replace(".", ",")} reais para todos os babas. Toque em “Confirmar” para aplicar.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        O reajuste vale para os próximos PIX de convidado gerados. Convites já cobrados mantêm o
        valor pago.
      </p>
    </div>
  );
}

/** Card genérico para parametrizar um valor em `configuracoes`, com dupla confirmação. */
function ConfigValorCard({
  titulo,
  chave,
  padrao,
  consulta,
  invalidarKey,
  placeholder,
  descricao,
  Icone,
}: {
  titulo: string;
  chave: string;
  padrao: number;
  consulta: ReturnType<typeof valorMultaAtrasoQuery>;
  invalidarKey: string;
  placeholder: string;
  descricao: string;
  Icone: React.ComponentType<{ className?: string }>;
}) {
  const qc = useQueryClient();
  const { data: valorAtual } = useQuery(consulta);
  const [novo, setNovo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = Number(novo.replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0)
        throw new Error("Informe um valor válido em reais.");
      const { error } = await supabase
        .from("configuracoes")
        .upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${titulo} atualizado`, { description: descricao });
      setConfirmando(false);
      setNovo("");
      void qc.invalidateQueries({ queryKey: [invalidarKey] });
      void qc.invalidateQueries({ queryKey: ["situacao-financeira"] });
      void qc.invalidateQueries({ queryKey: ["mensalidades-minhas"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const formatado = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Icone className="size-4 text-gold" />
        <p className="text-xs uppercase tracking-widest text-gold">{titulo}</p>
      </div>
      <p className="font-display text-3xl text-gold">{formatado(Number(valorAtual ?? padrao))}</p>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          placeholder={placeholder}
          aria-label={`Novo valor — ${titulo}`}
          value={novo}
          className="h-11"
          onChange={(e) => {
            setNovo(e.target.value);
            setConfirmando(false);
          }}
        />
        <Button
          variant={confirmando ? "destructive" : "gold"}
          size="lg"
          disabled={!novo || salvar.isPending}
          onClick={() => (confirmando ? salvar.mutate() : setConfirmando(true))}
        >
          {confirmando ? "Confirmar" : "Alterar"}
        </Button>
      </div>
      {confirmando && (
        <p className="text-[11px] text-destructive">
          Confirme novamente: o valor passará a ser {novo.replace(".", ",")} reais. Toque em
          “Confirmar” para aplicar.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">{descricao}</p>
    </div>
  );
}

/** Multa por atraso (padrão R$ 5,00), aplicada em mensalidades vencidas. */
function ValorMultaCard() {
  return (
    <ConfigValorCard
      titulo="Multa por atraso"
      chave="valor_multa_atraso"
      padrao={VALOR_MULTA_ATRASO_PADRAO}
      consulta={valorMultaAtrasoQuery()}
      invalidarKey="valor-multa-atraso"
      placeholder="Novo valor (ex.: 5)"
      descricao="Acréscimo cobrado em cada mensalidade vencida e ainda pendente. Use 0 para desativar a multa."
      Icone={AlertCircle}
    />
  );
}

/** Taxa de Associação (reinscrição), exigida na retomada de vínculo. */
function ValorTaxaAssociacaoCard() {
  return (
    <ConfigValorCard
      titulo="Taxa de Associação (reinscrição)"
      chave="valor_taxa_associacao"
      padrao={VALOR_MENSALIDADE_PADRAO}
      consulta={valorTaxaAssociacaoQuery()}
      invalidarKey="valor-taxa-associacao"
      placeholder="Novo valor (ex.: 15)"
      descricao="Cobrada junto com os débitos retroativos quando o associado inadimplente retoma o vínculo."
      Icone={ShieldAlert}
    />
  );
}

/** Taxas cobradas por forma de pagamento (repasse ao pagador). */
function TaxasPagamentoCard() {
  const qc = useQueryClient();
  const { data: taxas } = useQuery(taxasPagamentoQuery());
  const [valores, setValores] = useState<Record<MetodoPagamento, string>>({
    pix: "",
    debito: "",
    credito: "",
  });
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!taxas) return;
    setValores({
      pix: String(taxas.pix).replace(".", ","),
      debito: String(taxas.debito).replace(".", ","),
      credito: String(taxas.credito).replace(".", ","),
    });
  }, [taxas]);

  const salvar = useMutation({
    mutationFn: async () => {
      const linhas = METODOS_PAGAMENTO.map((metodo) => {
        const percentual = Number(valores[metodo].replace(",", "."));
        if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100)
          throw new Error("Informe percentuais entre 0 e 100.");
        return {
          chave: CHAVES_TAXA[metodo],
          valor: percentual,
          atualizado_em: new Date().toISOString(),
        };
      });
      const { error } = await supabase
        .from("configuracoes")
        .upsert(linhas, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Taxas atualizadas", {
        description: "Vale para todas as próximas cobranças (PIX, débito e crédito).",
      });
      setConfirmando(false);
      void qc.invalidateQueries({ queryKey: ["taxas-pagamento"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const exemplo = 20;

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-gold" />
        <p className="text-xs uppercase tracking-widest text-gold">Taxas por forma de pagamento</p>
      </div>

      <div className="space-y-2">
        {METODOS_PAGAMENTO.map((metodo) => {
          const digitado = Number(valores[metodo].replace(",", "."));
          const percentual = Number.isFinite(digitado) && digitado > 0 ? digitado : 0;
          return (
            <div
              key={metodo}
              className="space-y-1 rounded-lg border border-border/60 bg-surface p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {ROTULO_METODO[metodo]}
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    inputMode="decimal"
                    aria-label={`Taxa do ${ROTULO_METODO[metodo]} em %`}
                    className="h-9 w-20 text-right"
                    value={valores[metodo]}
                    onChange={(e) => {
                      setValores((v) => ({ ...v, [metodo]: e.target.value }));
                      setConfirmando(false);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Em {formatarReais(exemplo)} o cliente paga{" "}
                <strong className="text-foreground">
                  {formatarReais(calcularCobranca(exemplo, percentual).total)}
                </strong>
                .
              </p>
            </div>
          );
        })}
      </div>

      <Button
        variant={confirmando ? "destructive" : "gold"}
        size="lg"
        className="w-full"
        disabled={salvar.isPending}
        onClick={() => (confirmando ? salvar.mutate() : setConfirmando(true))}
      >
        {confirmando ? "Confirmar taxas" : "Salvar taxas"}
      </Button>
      {confirmando && (
        <p className="text-[11px] text-destructive">
          Confirme novamente: as taxas passam a valer para todas as próximas cobranças.
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={() => {
          setValores({
            pix: String(TAXAS_PADRAO.pix).replace(".", ","),
            debito: String(TAXAS_PADRAO.debito).replace(".", ","),
            credito: String(TAXAS_PADRAO.credito).replace(".", ","),
          });
          setConfirmando(false);
        }}
      >
        <RotateCcw className="size-3" /> Restaurar padrão do Mercado Pago
      </Button>
      <p className="text-[11px] text-muted-foreground">
        A taxa é somada ao valor e arredondada para cima (até o centavo), para o líquido cair no
        mesmo dia na conta do Mercado Pago. O PIX já cai na hora; nos cartões a taxa cobre o
        recebimento no mesmo dia. Use 0 para não repassar taxa nenhuma.
      </p>
    </div>
  );
}

/** Executa manualmente a rotina financeira (multas + suspensão por 1 mês de atraso). */
function RotinaFinanceiraCard() {
  const qc = useQueryClient();

  const rodar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rotina_financeira_diaria");
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (qtd) => {
      toast.success("Rotina financeira executada", {
        description:
          qtd > 0
            ? `${qtd} conta(s) marcada(s) como inadimplente.`
            : "Nenhuma nova inadimplência encontrada.",
      });
      void qc.invalidateQueries({ queryKey: ["associados-todos"] });
      void qc.invalidateQueries({ queryKey: ["mensalidades-mes"] });
      void qc.invalidateQueries({ queryKey: ["mensalidades-pendentes-todas"] });
    },
    onError: (e: Error) => toast.error("Não foi possível executar", { description: e.message }),
  });

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="size-4 text-gold" />
        <p className="text-xs uppercase tracking-widest text-gold">Rotina financeira</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Recalcula multas e suspende (status{" "}
        <strong className="text-foreground">INADIMPLENTE</strong>) quem está com 1 mês de atraso.
        Roda automaticamente todo dia; use o botão para forçar agora.
      </p>
      <Button
        variant="goldOutline"
        size="lg"
        className="w-full"
        disabled={rodar.isPending}
        onClick={() => rodar.mutate()}
      >
        <RefreshCw className="size-4" /> Executar agora
      </Button>
    </div>
  );
}
