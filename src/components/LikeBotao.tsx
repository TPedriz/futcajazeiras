import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { likesDoEventoQuery, alternarLikeFeed, curtidoresQuery } from "@/lib/babaQueries";
import { AvatarJogador } from "@/components/AvatarJogador";
import { LinkPerfilJogador } from "@/components/LinkPerfilJogador";
import { InstagramLink } from "@/components/InstagramLink";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Botão de curtida de uma publicação do feed.
 * - Contador ❤️ atualiza sem recarregar a página (mutation otimista + Realtime).
 * - Clicar no contador abre a lista "Curtido por".
 * - Idempotente no banco (RPC alternar_like_feed).
 */
export function LikeBotao({
  eventoId,
  userId,
  compacto = false,
}: {
  eventoId: string;
  userId?: string | undefined;
  compacto?: boolean;
}) {
  const qc = useQueryClient();
  const [listaAberta, setListaAberta] = useState(false);

  const { data: likes, isLoading } = useQuery(likesDoEventoQuery(eventoId, userId));
  const { data: curtidores } = useQuery(curtidoresQuery(listaAberta ? eventoId : undefined));

  const mutation = useMutation({
    mutationFn: () => alternarLikeFeed(eventoId),
    onMutate: async () => {
      // Otimista: atualiza o contador antes da resposta do servidor.
      await qc.cancelQueries({ queryKey: ["likes-evento", eventoId] });
      const anterior = qc.getQueryData<{ total: number; curti: boolean }>([
        "likes-evento",
        eventoId,
        userId,
      ]);
      if (anterior) {
        const curti = !anterior.curti;
        qc.setQueryData(["likes-evento", eventoId, userId], {
          total: Math.max(0, anterior.total + (curti ? 1 : -1)),
          curti,
        });
      }
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) {
        qc.setQueryData(["likes-evento", eventoId, userId], ctx.anterior);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["likes-evento", eventoId] });
      void qc.invalidateQueries({ queryKey: ["curtidores", eventoId] });
    },
  });

  const total = likes?.total ?? 0;
  const curti = likes?.curti ?? false;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (!userId) return;
            mutation.mutate();
          }}
          disabled={!userId || mutation.isPending}
          aria-pressed={curti}
          aria-label={curti ? "Descurtir" : "Curtir"}
          title={userId ? (curti ? "Descurtir" : "Curtir") : "Entre para curtir"}
          className={cn(
            "group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm transition-all",
            curti ? "text-rose-400" : "text-muted-foreground hover:text-rose-300",
            mutation.isPending && "opacity-60",
            compacto && "px-1.5",
          )}
        >
          <Heart
            className={cn(
              "size-4 transition-transform group-hover:scale-110",
              curti && "fill-rose-400",
            )}
          />
          <span className="tabular-nums">{isLoading ? "" : total}</span>
        </button>

        {total > 0 && (
          <button
            type="button"
            onClick={() => setListaAberta(true)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            aria-label="Ver quem curtiu"
          >
            <Users className="size-3.5" />
            <span className="underline-offset-2 hover:underline">
              {total === 1 ? "1 curtida" : `${total} curtidas`}
            </span>
          </button>
        )}
      </div>

      {/* Lista "Curtido por" */}
      <Dialog open={listaAberta} onOpenChange={setListaAberta}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="size-4 fill-rose-400 text-rose-400" /> Curtido por
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {!curtidores || curtidores.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {curtidores ? "Ninguém curtiu ainda." : "Carregando..."}
              </p>
            ) : (
              curtidores.map((c) => (
                <LinkPerfilJogador key={c.id} id={c.id}>
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 transition-colors hover:border-gold/40">
                    <AvatarJogador caminho={c.avatar_url} nome={c.nome} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{c.nome}</p>
                      <p className="text-[11px] text-muted-foreground">Nível {c.nivel_atual}</p>
                    </div>
                    <InstagramLink valor={c.instagram} compacto />
                  </div>
                </LinkPerfilJogador>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
