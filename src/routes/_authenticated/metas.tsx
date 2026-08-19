import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, HeartHandshake, ChevronDown, ChevronUp } from "lucide-react";
import {
  perfilAtualQuery,
  metasQuery,
  contribuicoesMetaQuery,
  minhasContribuicoesQuery,
} from "@/lib/babaQueries";
import { MetaCard } from "@/components/MetaCard";
import { ContribuicaoDialog } from "@/components/ContribuicaoDialog";
import { CadastroItemMetaDialog } from "@/components/CadastroItemMetaDialog";
import { PixMetaPagamento } from "@/components/PixMetaPagamento";
import type { ContribuicaoMeta } from "@/lib/babaQueries";
import { AvatarJogador } from "@/components/AvatarJogador";
import { LinkPerfilJogador } from "@/components/LinkPerfilJogador";
import { formatarReais } from "@/lib/redeSocial";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Meta = Database["public"]["Tables"]["metas"]["Row"];

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas da Comunidade — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Metas coletivas da comunidade Fut Cajazeiras: coletes, resenha pós-baba, infraestrutura e mais. Contribua via PIX.",
      },
    ],
  }),
  component: MetasPage,
});

function MetasPage() {
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());
  const { data: metas, isLoading, isError } = useQuery(metasQuery());
  const { data: minhas } = useQuery(minhasContribuicoesQuery(perfilData?.user.id));

  const [metaEmContribuicao, setMetaEmContribuicao] = useState<Meta | null>(null);
  const [metaEmCadastroItem, setMetaEmCadastroItem] = useState<Meta | null>(null);
  const [metaEmPagamento, setMetaEmPagamento] = useState<Meta | null>(null);
  const [contribuicaoEmPagamento, setContribuicaoEmPagamento] = useState<ContribuicaoMeta | null>(
    null,
  );
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);

  const ativas = (metas ?? []).filter((m) => m.status === "ativa");
  const outras = (metas ?? []).filter((m) => m.status !== "ativa");

  const minhasAtivas = (minhas ?? []).filter((c) => c.status === "confirmada").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/inicio" aria-label="Voltar" className="shrink-0">
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          <HeartHandshake className="size-6 text-gold" />
          <div>
            <h1 className="font-display text-2xl text-foreground">Metas da comunidade</h1>
            <p className="text-xs text-muted-foreground">
              A comunidade se une e cada um contribui com o que pode.
            </p>
          </div>
        </div>
      </div>

      {/* Minhas participações */}
      {minhasAtivas > 0 && (
        <div className="card-premium flex items-center justify-between p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <HeartHandshake className="size-4 text-gold" />
            Você já apoiou {minhasAtivas} {minhasAtivas === 1 ? "meta" : "metas"}!
          </p>
          <span className="text-xs text-muted-foreground">
            {formatarReais(
              (minhas ?? [])
                .filter((c) => c.status === "confirmada")
                .reduce((s, c) => s + c.valor, 0),
            )}{" "}
            no total
          </span>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card-premium animate-pulse space-y-3 p-4">
              <div className="h-5 w-2/3 rounded bg-surface" />
              <div className="h-3 rounded bg-surface" />
              <div className="h-2 rounded-full bg-surface" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="card-premium p-6 text-center">
          <p className="font-display text-xl">Não foi possível carregar as metas</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente novamente em instantes.</p>
        </div>
      )}

      {!isLoading && !isError && (metas ?? []).length === 0 && (
        <div className="card-premium p-6 text-center">
          <p className="font-display text-xl">Nenhuma meta ativa no momento</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A diretoria pode criar metas para a comunidade quando precisar.
          </p>
        </div>
      )}

      {/* Metas ativas */}
      {ativas.length > 0 && (
        <div className="space-y-3">
          {ativas.map((meta) => (
            <div key={meta.id} className="space-y-2">
              <MetaCard
                meta={meta}
                onContribuir={(m) => setMetaEmContribuicao(m)}
                onCadastrarItem={(m) => setMetaEmCadastroItem(m)}
                onPagarItem={(m, c) => {
                  setMetaEmPagamento(m);
                  setContribuicaoEmPagamento(c);
                }}
              />
              <HistoricoMeta
                metaId={meta.id}
                aberto={historicoAberto === meta.id}
                onToggle={() => setHistoricoAberto(historicoAberto === meta.id ? null : meta.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Metas encerradas/atingidas */}
      {outras.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Encerradas</p>
          {outras.map((meta) => (
            <div key={meta.id} className="space-y-2">
              <MetaCard meta={meta} />
              <HistoricoMeta
                metaId={meta.id}
                aberto={historicoAberto === meta.id}
                onToggle={() => setHistoricoAberto(historicoAberto === meta.id ? null : meta.id)}
              />
            </div>
          ))}
        </div>
      )}

      <ContribuicaoDialog
        meta={
          metaEmContribuicao
            ? {
                id: metaEmContribuicao.id,
                titulo: metaEmContribuicao.titulo,
                status: metaEmContribuicao.status,
              }
            : null
        }
        aberto={!!metaEmContribuicao}
        onAbertoChange={(aberto) => {
          if (!aberto) setMetaEmContribuicao(null);
        }}
      />

      <CadastroItemMetaDialog
        meta={metaEmCadastroItem}
        aberto={!!metaEmCadastroItem}
        onAbertoChange={(aberto) => {
          if (!aberto) setMetaEmCadastroItem(null);
        }}
      />

      {/* Etapa 2 — pagamento de um item já cadastrado (pendente) */}
      <PixMetaPagamento
        aberto={!!metaEmPagamento && !!contribuicaoEmPagamento}
        contribuicaoId={contribuicaoEmPagamento?.id ?? null}
        titulo={metaEmPagamento?.titulo ?? "Item"}
        onAbertoChange={(aberto) => {
          if (!aberto) {
            setMetaEmPagamento(null);
            setContribuicaoEmPagamento(null);
          }
        }}
      />
    </div>
  );
}

/** Histórico de contribuições de uma meta (colapsável). */
function HistoricoMeta({
  metaId,
  aberto,
  onToggle,
}: {
  metaId: string;
  aberto: boolean;
  onToggle: () => void;
}) {
  const { data: contribuicoes } = useQuery(contribuicoesMetaQuery(metaId));
  const confirmadas = (contribuicoes ?? []).filter((c) => c.status === "confirmada");

  return (
    <div className="card-premium p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground"
        aria-expanded={aberto}
      >
        Ver contribuições ({confirmadas.length})
        {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {aberto && (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {confirmadas.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Nenhuma contribuição confirmada ainda.
            </p>
          ) : (
            confirmadas.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-surface p-2"
              >
                <AvatarJogador
                  caminho={c.perfis_publicos?.avatar_url}
                  nome={c.perfis_publicos?.nome}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  {c.anonima ? (
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      Contribuição anônima
                    </p>
                  ) : c.perfis_publicos ? (
                    <LinkPerfilJogador id={c.perfis_publicos.id}>
                      <p className="truncate text-xs font-semibold text-foreground hover:text-gold">
                        {c.perfis_publicos.nome}
                      </p>
                    </LinkPerfilJogador>
                  ) : (
                    <p className="truncate text-xs font-semibold text-muted-foreground">Jogador</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(c.confirmada_em ?? c.criado_em), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}{" "}
                    • confirmada
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-gold">
                  {formatarReais(c.valor)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
