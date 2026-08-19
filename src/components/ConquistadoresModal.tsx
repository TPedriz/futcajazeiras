import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AvatarJogador } from "@/components/AvatarJogador";
import { LinkPerfilJogador } from "@/components/LinkPerfilJogador";
import { InstagramLink } from "@/components/InstagramLink";
import { conquistadoresQuery } from "@/lib/babaQueries";
import { instagramFormatado } from "@/lib/redeSocial";
import { Search, Trophy, Users } from "lucide-react";

export interface ConquistaResumoModal {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  raridade?: string;
  descricao?: string;
}

/**
 * Modal "N jogadores conquistaram" — lista todos os usuários que possuem
 * uma conquista, com busca, ordenação e link para o perfil de cada um.
 */
export function ConquistadoresModal({
  conquista,
  aberto,
  onAbertoChange,
}: {
  conquista: ConquistaResumoModal | null;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  const [termo, setTermo] = useState("");

  const { data: conquistadores, isLoading, isError } = useQuery(conquistadoresQuery(conquista?.id));

  const filtrados = useMemo(() => {
    if (!conquistadores) return [];
    const t = termo.trim().toLowerCase();
    if (!t) return conquistadores;
    return conquistadores.filter((c) => {
      const nome = c.perfil?.nome.toLowerCase() ?? "";
      const insta = instagramFormatado(c.perfil?.instagram)?.toLowerCase() ?? "";
      return nome.includes(t) || insta.includes(t);
    });
  }, [conquistadores, termo]);

  const total = conquistadores?.length ?? 0;

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <span className="text-xl">{conquista?.icone ?? "🏆"}</span>
            <span>
              <span className="block">{conquista?.nome ?? "Conquista"}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {conquista?.descricao ?? ""}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold">
            <Users className="size-4" />
            {isLoading
              ? "…"
              : `${total} ${total === 1 ? "jogador conquistou" : "jogadores conquistaram"}`}
          </span>
        </div>

        {/* Busca local (client-side) — a lista já é paginada no banco (200). */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por nome ou @instagram..."
            className="pl-9"
            aria-label="Buscar jogador"
          />
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card-premium animate-pulse p-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-surface" />
                    <div className="h-3 w-1/3 rounded bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Não foi possível carregar os jogadores.
            </p>
          )}

          {!isLoading && !isError && filtrados.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Trophy className="size-8 text-gold/60" />
              <p className="text-sm font-semibold text-foreground">
                {total === 0 ? "Ninguém conquistou isso ainda." : "Nenhum jogador encontrado."}
              </p>
              <p className="text-xs text-muted-foreground">
                {total === 0
                  ? "Seja o primeiro a desbloquear essa conquista!"
                  : "Tente outro nome ou @instagram."}
              </p>
            </div>
          )}

          {!isLoading &&
            !isError &&
            filtrados.map((c) => (
              <LinkPerfilJogador key={c.usuario_id} id={c.perfil?.id}>
                <div className="card-premium flex items-center gap-3 p-3 transition-colors hover:border-gold/40">
                  <AvatarJogador caminho={c.perfil?.avatar_url} nome={c.perfil?.nome} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {c.perfil?.nome ?? "Jogador"}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Nível {c.perfil?.nivel_atual ?? 1}</span>
                      <span aria-hidden>•</span>
                      <span>{c.total_conquistas} conquistas</span>
                    </div>
                  </div>
                  <InstagramLink valor={c.perfil?.instagram} compacto />
                </div>
              </LinkPerfilJogador>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
