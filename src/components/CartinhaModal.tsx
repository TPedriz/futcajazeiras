import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Share2, Loader2 } from "lucide-react";
import {
  cartinhaPublicaQuery,
  conquistasEmDestaqueQuery,
  rankingDoMesQuery,
  mesReferencia,
} from "@/lib/babaQueries";
import { PlayerCard } from "@/components/PlayerCard";
import { temaEfetivo, temaBasePorOvr, type TemaCarta } from "@/lib/cartinha";
import { rankingDeCategoria } from "@/lib/gamificacao";
import { baixarCartinha, compartilharCartinha } from "@/lib/cartinhaExport";

interface CartinhaContexto {
  abrirCartinha: (usuarioId: string) => void;
}

const ContextoCartinha = createContext<CartinhaContexto>({
  abrirCartinha: () => {},
});

/** Hook para abrir a cartinha de um jogador de qualquer lugar do site. */
export function useCartinha() {
  return useContext(ContextoCartinha);
}

function CartinhaDoModal({ usuarioId }: { usuarioId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: perfil } = useQuery(cartinhaPublicaQuery(usuarioId));
  const { data: destaquesMap } = useQuery(conquistasEmDestaqueQuery());
  const referencia = mesReferencia();
  const { data: ranking } = useQuery(rankingDoMesQuery(referencia));

  const [exportando, setExportando] = useState(false);

  if (!perfil) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Carregando cartinha…</p>;
  }

  const posicao = perfil.posicao;
  const nivel = perfil.nivel_atual ?? 1;
  const top1Mes = (() => {
    if (!ranking) return false;
    const categorias = ["gols", "assistencias", "penaltis"] as const;
    return categorias.some((cat) => {
      const r = rankingDeCategoria(ranking, cat);
      return r[0]?.usuario_id === usuarioId;
    });
  })();

  const base = temaBasePorOvr(perfil.ovr ?? 40) as TemaCarta;
  const tema = temaEfetivo(base, {
    top1Mes,
    nivel,
    goleiroDestaque: posicao === "goleiro" && (perfil.stat_fisico ?? 0) >= 70,
  });

  const conquistas = (destaquesMap?.get(usuarioId) ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    icone: c.icone,
  }));

  const aoExportar = async (tipo: "baixar" | "compartilhar") => {
    if (!ref.current) return;
    setExportando(true);
    try {
      const nomeArquivo = (perfil.nome ?? "jogador").toLowerCase().replace(/\s+/g, "-");
      const ok =
        tipo === "baixar"
          ? await baixarCartinha(ref.current, `cartinha-${nomeArquivo}.png`)
          : await compartilharCartinha(ref.current);
      if (!ok) toast.error("Não foi possível exportar a cartinha");
    } catch {
      toast.error("Não foi possível exportar a cartinha");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-2">
      <PlayerCard
        ref={ref}
        nome={perfil.nome ?? "Jogador"}
        fotoUrl={perfil.avatar_url}
        posicao={(perfil.posicao as "goleiro" | "linha") ?? "linha"}
        ovr={perfil.ovr ?? 40}
        pac={perfil.stat_ritmo ?? 40}
        sho={perfil.stat_finalizacao ?? 40}
        pas={perfil.stat_passe ?? 40}
        dri={perfil.stat_drible ?? 40}
        def={perfil.stat_defesa ?? 40}
        phy={perfil.stat_fisico ?? 40}
        nivel={nivel}
        tema={tema}
        conquistas={conquistas}
        instagram={perfil.instagram}
      />
      <div className="grid w-full grid-cols-2 gap-2">
        <Button variant="gold" disabled={exportando} onClick={() => aoExportar("baixar")}>
          {exportando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Baixar
        </Button>
        <Button
          variant="goldOutline"
          disabled={exportando}
          onClick={() => aoExportar("compartilhar")}
        >
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </div>
    </div>
  );
}

/** Abre a cartinha de um jogador em um modal. */
export function CartinhaModal({
  usuarioId,
  onClose,
}: {
  usuarioId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!usuarioId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {usuarioId && <CartinhaDoModal usuarioId={usuarioId} />}
      </DialogContent>
    </Dialog>
  );
}

/** Provedor global: permite abrir a cartinha de qualquer jogador do site. */
export function CartinhaProvider({ children }: { children: React.ReactNode }) {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const abrirCartinha = useCallback((id: string) => setUsuarioId(id), []);

  return (
    <ContextoCartinha.Provider value={{ abrirCartinha }}>
      {children}
      <CartinhaModal usuarioId={usuarioId} onClose={() => setUsuarioId(null)} />
    </ContextoCartinha.Provider>
  );
}
