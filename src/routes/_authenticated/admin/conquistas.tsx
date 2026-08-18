import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todosAssociadosQuery, conquistasQuery } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { AvatarJogador } from "@/components/AvatarJogador";
import { AchievementRarity } from "@/components/AchievementRarity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Award, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — Painel Admin | Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Conceda ou remova conquistas históricas e raras dos jogadores do Fut Cajazeiras a qualquer momento.",
      },
      { property: "og:title", content: "Conquistas — Painel Admin | Fut Cajazeiras" },
      {
        property: "og:description",
        content: "Diretoria concede conquistas manuais aos jogadores do Fut Cajazeiras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(todosAssociadosQuery()),
  component: AdminConquistasPage,
});

function AdminConquistasPage() {
  const qc = useQueryClient();
  const { data: jogadores } = useSuspenseQuery(todosAssociadosQuery());
  const { data: catalogo } = useQuery(conquistasQuery());
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const jogador = jogadores.find((j) => j.id === selecionado) ?? null;

  const { data: doJogador } = useQuery({
    queryKey: ["conquistas-do-usuario", selecionado],
    enabled: !!selecionado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("conquistas_do_usuario", {
        _usuario: selecionado!,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const jaTem = new Set((doJogador ?? []).map((c) => c.conquista_id));

  const conceder = useMutation({
    mutationFn: async ({ conquista, remover }: { conquista: string; remover: boolean }) => {
      if (!selecionado) return;
      const { error } = remover
        ? await supabase.rpc("admin_remove_conquista", {
            _usuario: selecionado,
            _conquista: conquista,
          })
        : await supabase.rpc("admin_concede_conquista", {
            _usuario: selecionado,
            _conquista: conquista,
          });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.remover ? "Conquista removida" : "Conquista concedida!");
      void qc.invalidateQueries({ queryKey: ["conquistas-do-usuario", selecionado] });
      void qc.invalidateQueries({ queryKey: ["minhas-conquistas", selecionado] });
      void qc.invalidateQueries({ queryKey: ["conquistas-em-destaque"] });
      void qc.invalidateQueries({ queryKey: ["feed-eventos"] });
    },
    onError: (e: Error) => toast.error("Não foi possível concluir", { description: e.message }),
  });

  const filtrados = jogadores.filter((j) =>
    j.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="card-premium p-4">
        <p className="text-xs uppercase tracking-widest text-gold">Conquistas manuais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha um jogador e conceda (ou remova) qualquer conquista do catálogo — inclusive as
          históricas, como Fundador e Sócio-Fundador.
        </p>
      </div>

      <div className="card-premium space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar jogador pelo nome"
            aria-label="Buscar jogador"
            className="pl-9"
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {filtrados.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setSelecionado(j.id)}
              className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                selecionado === j.id
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border bg-surface hover:bg-surface-elevated"
              }`}
            >
              <AvatarJogador caminho={j.avatar_url} nome={j.nome} size="sm" />
              <span className="truncate text-sm font-semibold">{j.nome}</span>
            </button>
          ))}
          {filtrados.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum jogador encontrado.
            </p>
          )}
        </div>
      </div>

      {jogador && (
        <div className="card-premium space-y-3 p-4">
          <div className="flex items-center gap-3">
            <AvatarJogador caminho={jogador.avatar_url} nome={jogador.nome} size="sm" />
            <div>
              <p className="font-display text-xl">{jogador.nome}</p>
              <p className="text-xs text-muted-foreground">
                {(doJogador ?? []).length} conquista(s) desbloqueada(s)
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {(catalogo ?? []).map((c) => {
              const tem = jaTem.has(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2"
                >
                  <span className="text-xl">{c.icone}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.nome}</p>
                    <AchievementRarity raridade={c.raridade} />
                  </div>
                  <Button
                    size="sm"
                    variant={tem ? "ghost" : "secondary"}
                    disabled={conceder.isPending}
                    onClick={() => conceder.mutate({ conquista: c.id, remover: tem })}
                  >
                    {tem ? (
                      <>
                        <Trash2 className="size-4" /> Remover
                      </>
                    ) : (
                      <>
                        <Award className="size-4" /> Conceder
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
