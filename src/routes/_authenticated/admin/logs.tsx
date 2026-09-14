import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LOGS_PAGE_SIZE, logsAuditoriaQuery } from "@/lib/babaQueries";
import {
  CATEGORIAS_LOG,
  parseMudancas,
  rotuloCategoria,
  rotuloMetodoPagamento,
  rotuloOrigem,
  type LogAuditoria,
} from "@/lib/logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BadgeCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  CreditCard,
  Gavel,
  HandHeart,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Target,
  UserCheck,
  UserCog,
  Wallet,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "Log de auditoria — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Histórico interno da diretoria: quem alterou o cadastro de quem, mudanças de cargo, financeiro, pagamentos com a forma de pagamento, lista do baba, convidados, punições e metas.",
      },
    ],
  }),
  component: LogsPage,
});

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  perfil: UserCog,
  cargos: BadgeCheck,
  financeiro: Wallet,
  pagamento: CreditCard,
  lista: ClipboardList,
  convidados: HandHeart,
  punicoes: Gavel,
  metas: Target,
  agenda: CalendarDays,
  sessoes: CalendarPlus,
  associacao: UserCheck,
  sistema: Info,
};

const CORES: Record<string, string> = {
  perfil: "bg-gold/10 text-gold",
  cargos: "bg-gold/10 text-gold",
  financeiro: "bg-success/15 text-success",
  pagamento: "bg-success/15 text-success",
  lista: "bg-muted text-muted-foreground",
  convidados: "bg-gold/10 text-gold",
  punicoes: "bg-destructive/10 text-destructive",
  metas: "bg-gold/10 text-gold",
  agenda: "bg-muted text-muted-foreground",
  sessoes: "bg-muted text-muted-foreground",
  associacao: "bg-gold/10 text-gold",
  sistema: "bg-muted text-muted-foreground",
};

function LogsPage() {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [antesDe, setAntesDe] = useState<string | null>(null);
  const [registros, setRegistros] = useState<LogAuditoria[]>([]);

  const { data, isFetching, isError, error, refetch } = useQuery(
    logsAuditoriaQuery({ categoria, busca: buscaAplicada, antesDe }),
  );

  // Acumula as páginas; troca de filtro reinicia a lista.
  useEffect(() => {
    if (!data) return;
    setRegistros((atual) => {
      if (!antesDe) return data;
      const vistos = new Set(atual.map((l) => l.id));
      return [...atual, ...data.filter((l) => !vistos.has(l.id))];
    });
  }, [data, antesDe]);

  const trocarFiltro = (novaCategoria: string | null) => {
    setCategoria(novaCategoria);
    setAntesDe(null);
    setRegistros([]);
  };

  const aplicarBusca = () => {
    setBuscaAplicada(busca);
    setAntesDe(null);
    setRegistros([]);
  };

  const limpar = () => {
    setBusca("");
    setBuscaAplicada("");
    trocarFiltro(null);
  };

  const carregarMais = () => {
    const ultimo = registros[registros.length - 1];
    if (ultimo) setAntesDe(ultimo.criado_em);
  };

  const temFiltro = !!categoria || buscaAplicada.length > 0;
  const temMais = (data?.length ?? 0) === LOGS_PAGE_SIZE;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Diretoria</p>
          <h2 className="font-display text-2xl">Log de auditoria</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tudo que foi alterado no sistema: quem fez, em quem e o que mudou (de → para).
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </Button>
      </div>

      {/* Busca */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          aplicarBusca();
        }}
      >
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por jogador, admin ou descrição"
          aria-label="Buscar no log"
          className="h-11"
        />
        <Button type="submit" variant="goldOutline" size="lg" aria-label="Buscar">
          <Search className="size-4" />
        </Button>
      </form>

      {/* Categorias */}
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        <button
          type="button"
          onClick={() => trocarFiltro(null)}
          className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
            categoria === null
              ? "border-gold/60 bg-gold/10 text-gold"
              : "border-border/60 bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          Tudo
        </button>
        {CATEGORIAS_LOG.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => trocarFiltro(c.id)}
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              categoria === c.id
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-border/60 bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {registros.length} registro{registros.length === 1 ? "" : "s"}
          {temFiltro ? " no filtro atual" : ""}
        </span>
        {temFiltro && (
          <button
            type="button"
            onClick={limpar}
            className="inline-flex items-center gap-1 text-gold"
          >
            <X className="size-3" /> Limpar filtros
          </button>
        )}
      </div>

      {isError && (
        <div className="card-premium border border-destructive/40 p-4 text-sm text-destructive">
          Não foi possível carregar o log: {(error as Error)?.message ?? "erro inesperado"}. Se a
          migration do log ainda não foi aplicada, aplique-a no banco.
        </div>
      )}

      {isFetching && registros.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-gold" /> Carregando o log...
        </div>
      )}

      {!isFetching && registros.length === 0 && !isError && (
        <div className="card-premium p-6 text-center">
          <ClipboardList className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 font-display text-xl">Nenhum registro</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nada encontrado com os filtros atuais. As próximas alterações aparecem aqui.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {registros.map((log) => (
          <LogCard key={log.id} log={log} />
        ))}
      </ul>

      {temMais && (
        <Button
          variant="goldOutline"
          size="lg"
          className="w-full"
          onClick={carregarMais}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
          Carregar mais
        </Button>
      )}
    </div>
  );
}

function LogCard({ log }: { log: LogAuditoria }) {
  const Icone = ICONES[log.categoria] ?? Info;
  const mudancas = parseMudancas(log.mudancas);
  const metodo = rotuloMetodoPagamento(log.metodo_pagamento);
  const quando = new Date(log.criado_em);

  return (
    <li className="card-premium p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
            CORES[log.categoria] ?? "bg-muted text-muted-foreground"
          }`}
        >
          <Icone className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-gold">
              {rotuloCategoria(log.categoria)}
            </p>
            <span
              className="shrink-0 text-[10px] text-muted-foreground"
              title={format(quando, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            >
              {formatDistanceToNow(quando, { addSuffix: true, locale: ptBR })}
            </span>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-foreground">{log.descricao}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
              {log.ator_nome}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{rotuloOrigem(log.origem)}</span>
            {metodo && (
              <Badge className="bg-gold/15 text-[10px] text-gold">
                <CreditCard className="mr-1 size-3" />
                {metodo}
              </Badge>
            )}
          </div>

          {mudancas.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-lg border border-border/60 bg-surface p-2">
              {mudancas.map((m) => (
                <li key={m.campo} className="flex flex-wrap items-baseline gap-1 text-[11px]">
                  <span className="text-muted-foreground">{m.rotulo}:</span>
                  {m.de !== null && (
                    <span className="text-destructive/80 line-through decoration-destructive/30">
                      {m.de}
                    </span>
                  )}
                  {m.de !== null && m.para !== null && (
                    <span className="text-muted-foreground">→</span>
                  )}
                  {m.para !== null && <span className="text-success">{m.para}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
