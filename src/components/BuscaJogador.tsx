import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AvatarJogador } from "@/components/AvatarJogador";
import { LinkPerfilJogador } from "@/components/LinkPerfilJogador";
import { InstagramLink } from "@/components/InstagramLink";
import { buscarJogadoresQuery } from "@/lib/babaQueries";

/**
 * Barra de pesquisa de jogadores (nome ou @Instagram).
 * Mostra os resultados com foto, nome, nível e link para o perfil.
 */
export function BuscaJogador({ autoFoco = false }: { autoFoco?: boolean }) {
  const [termo, setTermo] = useState("");
  const { data: resultados, isLoading, isError } = useQuery(buscarJogadoresQuery(termo));

  const ativa = termo.trim().length >= 2;

  return (
    <div className="card-premium space-y-3 p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar jogador por nome ou @instagram..."
          className="h-12 pl-9 pr-9"
          autoFocus={autoFoco}
          aria-label="Buscar jogador"
        />
        {termo && (
          <button
            type="button"
            onClick={() => setTermo("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {!ativa ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" /> Digite pelo menos 2 caracteres para buscar.
        </p>
      ) : isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Buscando jogadores...
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">Não foi possível buscar os jogadores.</p>
      ) : resultados && resultados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum jogador encontrado.</p>
      ) : (
        <ul className="space-y-2" role="list">
          {(resultados ?? []).map((j) => (
            <li key={j.id}>
              <LinkPerfilJogador id={j.id}>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 transition-colors hover:border-gold/40">
                  <AvatarJogador caminho={j.avatar_url} nome={j.nome} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{j.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {j.posicao === "goleiro" ? "Goleiro" : "Linha"} • Nível {j.nivel_atual}
                    </p>
                  </div>
                  <InstagramLink valor={j.instagram} compacto />
                </div>
              </LinkPerfilJogador>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
