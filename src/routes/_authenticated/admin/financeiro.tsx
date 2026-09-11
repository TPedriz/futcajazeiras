import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  todosAssociadosQuery,
  mensalidadesDoMesQuery,
  mesReferencia,
  papeisTodosQuery,
  valorMensalidadeQuery,
  valorConvidadoQuery,
  valorMultaAtrasoQuery,
  valorTaxaAssociacaoQuery,
  vagasAssociadosQuery,
  LIMITE_ASSOCIADOS,
  VALOR_MENSALIDADE_PADRAO,
  VALOR_CONVIDADO_PADRAO,
  VALOR_MULTA_ATRASO_PADRAO,
} from "@/lib/babaQueries";
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
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: FinanceiroPage,
});

type FiltroStatus = "todos" | "pago" | "pendente";

function FinanceiroPage() {
  const { data: todos } = useSuspenseQuery(todosAssociadosQuery());
  const { data: papeis } = useQuery(papeisTodosQuery());
  const { data: totalAssociados } = useQuery(vagasAssociadosQuery());
  const [refDate, setRefDate] = useState(() => new Date(`${mesReferencia()}T12:00:00`));
  const [filtro, setFiltro] = useState<FiltroPapel>("todos");
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("todos");
  const referencia = mesReferencia(refDate);
  const { data: mensalidades } = useQuery(mensalidadesDoMesQuery(referencia));
  const qc = useQueryClient();

  const papelDe = (id: string) => {
    const meus = (papeis ?? []).filter((p) => p.user_id === id).map((p) => p.papel);
    if (meus.includes("administrador")) return "administrador";
    if (meus.includes("associado")) return "associado";
    return "convidado";
  };
  const porUsuario = new Map((mensalidades ?? []).map((m) => [m.usuario_id, m]));
  const associados = todos.filter((a) => filtro === "todos" || papelDe(a.id) === filtro);
  const visiveis = associados.filter((a) => {
    if (statusFiltro === "todos") return true;
    const ok = porUsuario.get(a.id)?.status === "pago";
    return statusFiltro === "pago" ? ok : !ok;
  });
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
      qc.invalidateQueries({ queryKey: ["associados-todos"] });
      qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const emDia = associados.filter((a) => porUsuario.get(a.id)?.status === "pago").length;
  const inadimplentes = associados.filter((a) => a.status_conta === "INADIMPLENTE").length;

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

      {inadimplentes > 0 && (
        <div className="card-premium flex items-center gap-2 border border-destructive/40 p-3">
          <ShieldAlert className="size-4 shrink-0 text-destructive" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-destructive">{inadimplentes}</strong> associado(s) com
            associação suspensa por inadimplência.
          </p>
        </div>
      )}

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

      <div className="grid grid-cols-3 gap-2">
        {(["todos", "pago", "pendente"] as const).map((s) => (
          <Button
            key={s}
            variant={statusFiltro === s ? "gold" : "outline"}
            size="sm"
            onClick={() => setStatusFiltro(s)}
          >
            {s === "todos" ? "Todos" : s === "pago" ? "Pagos" : "Pendentes"}
          </Button>
        ))}
      </div>

      <ValorMensalidadeCard />
      <ValorConvidadoCard />
      <ValorMultaCard />
      <ValorTaxaAssociacaoCard />
      <RotinaFinanceiraCard />

      <ul className="space-y-2">
        {visiveis.map((a) => {
          const ok = porUsuario.get(a.id)?.status === "pago";
          return (
            <li key={a.id} className="card-premium flex items-center gap-3 p-3">
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
                  {a.status_conta === "INADIMPLENTE" && (
                    <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-widest text-destructive">
                      Inadimplente
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {a.telefone || a.email}
                </p>
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
            </li>
          );
        })}
      </ul>
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
