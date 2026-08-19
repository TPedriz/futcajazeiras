import { useQuery } from "@tanstack/react-query";
import {
  Target,
  Users,
  CalendarClock,
  HeartHandshake,
  CheckCircle2,
  Lock,
  Shirt,
  UserRound,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { contribuicoesMetaQuery, perfilAtualQuery, type ContribuicaoMeta } from "@/lib/babaQueries";
import {
  formatarReais,
  progressoMeta,
  rotuloCategoriaMeta,
  rotuloStatusMeta,
  rotuloTipoArrecadacao,
} from "@/lib/redeSocial";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Meta = Database["public"]["Tables"]["metas"]["Row"];

function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Card de uma meta coletiva.
 * - Arrecadação aberta: valor livre + progresso (arrecadado/alvo).
 * - Arrecadação por item: custo fixo por item + contadores de cadastrados/pagos + prazos.
 */
export function MetaCard({
  meta,
  onContribuir,
  onCadastrarItem,
  onPagarItem,
  mostrarHistorico = true,
}: {
  meta: Meta;
  onContribuir?: (meta: Meta) => void;
  onCadastrarItem?: (meta: Meta) => void;
  onPagarItem?: (meta: Meta, contribuicao: ContribuicaoMeta) => void;
  mostrarHistorico?: boolean;
}) {
  const { data: contribuicoes } = useQuery(contribuicoesMetaQuery(meta.id));
  const { data: perfilData } = useQuery(perfilAtualQuery());
  const prog = progressoMeta(meta.valor_arrecadado, meta.valor_alvo);
  const atingida = meta.status === "atingida";
  const encerrada = meta.status === "encerrada";
  const ehItem = meta.tipo_arrecadacao === "item";

  const lista = contribuicoes ?? [];
  const confirmadas = lista.filter((c) => c.status === "confirmada");
  const pendentes = lista.filter((c) => c.status === "pendente");

  const minhaContribuicao = perfilData?.user.id
    ? lista.find((c) => c.user_id === perfilData.user.id && c.status !== "rejeitada")
    : undefined;

  const itemValor = Number(meta.valor_item ?? 0);

  return (
    <article
      className={cn(
        "card-premium p-4",
        atingida && "border-gold/50 shadow-[0_0_24px_rgba(217,167,86,0.25)]",
        encerrada && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg leading-tight text-foreground">
            {ehItem ? (
              <Shirt className="size-5 shrink-0 text-gold" />
            ) : (
              <Target className="size-5 shrink-0 text-gold" />
            )}
            {meta.titulo}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
              {rotuloCategoriaMeta(meta.categoria)}
            </span>
            <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
              {rotuloTipoArrecadacao(meta.tipo_arrecadacao)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 uppercase tracking-widest",
                atingida
                  ? "border border-gold/50 bg-gold/15 text-gold"
                  : "border border-border/50 bg-surface text-muted-foreground",
              )}
            >
              {rotuloStatusMeta(meta.status)}
            </span>
          </div>
        </div>
      </div>

      {meta.descricao && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{meta.descricao}</p>
      )}

      {ehItem ? (
        /* ---- Arrecadação por item ---- */
        <div className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between rounded-xl border border-gold/25 bg-gold/5 px-3 py-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Custo por item
            </span>
            <span className="font-display text-2xl text-gold">{formatarReais(itemValor)}</span>
          </div>

          {/* Contadores: cadastrados e pagos */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-surface p-3 text-center">
              <UserRound className="mx-auto size-4 text-muted-foreground" aria-hidden />
              <p className="mt-1 font-display text-2xl text-foreground">
                {pendentes.length + confirmadas.length}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                cadastrados
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface p-3 text-center">
              <CreditCard className="mx-auto size-4 text-success" aria-hidden />
              <p className="mt-1 font-display text-2xl text-success">{confirmadas.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">pagos</p>
            </div>
          </div>

          {/* Prazos */}
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Cadastro até{" "}
              <strong className="text-foreground">{dataCurta(meta.prazo_cadastro) ?? "—"}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Pagamento até{" "}
              <strong className="text-foreground">{dataCurta(meta.prazo_pagamento) ?? "—"}</strong>
            </div>
          </div>

          {/* Barra de arrecadação (opcional, se houver alvo) */}
          {(meta.valor_alvo ?? 0) > 0 && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  Arrecadado {formatarReais(prog.arrecadado)}
                </span>
                <span className="text-muted-foreground">{prog.percentual}%</span>
              </div>
              <Progress value={prog.percentual} className="h-2" />
            </div>
          )}
        </div>
      ) : (
        /* ---- Arrecadação aberta ---- */
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-xl text-gold">{formatarReais(prog.arrecadado)}</p>
            <p className="text-xs text-muted-foreground">de {formatarReais(prog.alvo)}</p>
          </div>
          <Progress value={prog.percentual} className={cn("h-3", atingida && "bg-gold/20")} />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{prog.percentual}% arrecadado</span>
            {!atingida && prog.restante > 0 && <span>faltam {formatarReais(prog.restante)}</span>}
          </div>
        </div>
      )}

      {/* Rodapé */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {!ehItem && confirmadas.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {confirmadas.length} {confirmadas.length === 1 ? "contribuinte" : "contribuintes"}
            </span>
          )}
          {!ehItem && meta.prazo && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              prazo {dataCurta(meta.prazo)}
            </span>
          )}
        </div>

        {atingida ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold">
            <CheckCircle2 className="size-4" /> Meta atingida!
          </span>
        ) : encerrada ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <Lock className="size-4" /> Encerrada
          </span>
        ) : ehItem ? (
          minhaContribuicao ? (
            minhaContribuicao.status === "confirmada" ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                <CheckCircle2 className="size-4" /> Cadastrado e pago ✓
              </span>
            ) : onPagarItem ? (
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                  <CreditCard className="size-3.5" /> Cadastro feito — falta o pagamento
                </span>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => onPagarItem(meta, minhaContribuicao)}
                >
                  <CreditCard className="size-4" /> Pagar agora
                </Button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-400">
                <CreditCard className="size-4" /> Cadastro pendente de pagamento
              </span>
            )
          ) : onCadastrarItem ? (
            <Button variant="gold" size="sm" onClick={() => onCadastrarItem(meta)}>
              <Shirt className="size-4" /> Me cadastrar
            </Button>
          ) : null
        ) : onContribuir ? (
          <Button variant="gold" size="sm" onClick={() => onContribuir(meta)}>
            <HeartHandshake className="size-4" /> Contribuir
          </Button>
        ) : null}
      </div>
    </article>
  );
}
