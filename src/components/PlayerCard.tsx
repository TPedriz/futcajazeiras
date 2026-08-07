import { forwardRef } from "react";
import { AvatarJogador } from "@/components/AvatarJogador";
import {
  SIGLAS_ATRIBUTO,
  posicaoSigla,
  ROTULOS_ATRIBUTO,
  ROTULOS_TEMA,
  type TemaCarta,
} from "@/lib/cartinha";
import escudoAsset from "@/assets/fut-cajazeiras-escudo.png.asset.json";

/** URL do escudo do Fut Cajazeiras (mesma asset usada no ranking do mês). */
const escudoUrl = escudoAsset.url;

/** Conquista em destaque exibida no rodapé da cartinha. */
export interface ConquistaMini {
  id: string;
  nome: string;
  icone: string;
}

/**
 * Temas visuais da cartinha. `fundo`/`borda`/`texto` são usados inline para
 * garantir fidelidade no PNG exportado (html-to-image), sem depender de
 * variáveis de tema do Tailwind no momento do raster.
 */
const TEMAS: Record<TemaCarta, { fundo: string; borda: string; brilho: string; texto: string }> = {
  bronze: {
    fundo: "linear-gradient(165deg, #2a1408 0%, #6b3a12 45%, #1c0d05 100%)",
    borda: "#c67a3b",
    brilho: "rgba(198,122,59,0.45)",
    texto: "#ffd9b0",
  },
  prata: {
    fundo: "linear-gradient(165deg, #23262e 0%, #6b7280 45%, #171a20 100%)",
    borda: "#cbd5e1",
    brilho: "rgba(203,213,225,0.5)",
    texto: "#f1f5f9",
  },
  ouro: {
    fundo: "linear-gradient(165deg, #3a2b07 0%, #c9a227 45%, #241a04 100%)",
    borda: "#e8c44d",
    brilho: "rgba(201,162,39,0.55)",
    texto: "#fff3c4",
  },
  totw: {
    fundo: "linear-gradient(165deg, #0b0b0d 0%, #1f1f26 40%, #0b0b0d 100%)",
    borda: "#f7d354",
    brilho: "rgba(247,211,84,0.65)",
    texto: "#ffe9a8",
  },
  icon: {
    fundo: "linear-gradient(165deg, #f7f3e3 0%, #e8d9a8 45%, #d9c48a 100%)",
    borda: "#b8942f",
    brilho: "rgba(184,148,47,0.55)",
    texto: "#3a2b07",
  },
  paredao: {
    fundo: "linear-gradient(165deg, #0e1226 0%, #3b4f8f 45%, #0a0c1c 100%)",
    borda: "#7c93ff",
    brilho: "rgba(124,147,255,0.6)",
    texto: "#dbe4ff",
  },
};

export interface PlayerCardProps {
  nome: string;
  fotoUrl?: string | null;
  posicao: "goleiro" | "linha";
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  nivel: number;
  tema: TemaCarta;
  conquistas?: ConquistaMini[];
  /** Classes extras aplicadas ao invólucro (largura, etc). */
  className?: string;
}

/** Cartinha de jogador estilo FUT. `ref` permite exportar como PNG. */
export const PlayerCard = forwardRef<HTMLDivElement, PlayerCardProps>(function PlayerCard(
  {
    nome,
    fotoUrl,
    posicao,
    ovr,
    pac,
    sho,
    pas,
    dri,
    def,
    phy,
    nivel,
    tema,
    conquistas = [],
    className = "",
  },
  ref,
) {
  const estilo = TEMAS[tema] ?? TEMAS.ouro;
  const atributos = [pac, sho, pas, dri, def, phy];
  // Tema "icon" tem fundo claro → marca d'água escura; demais usam clara.
  const filtroEscudo = tema === "icon" ? "brightness(0)" : "brightness(0) invert(1)";

  return (
    <div
      ref={ref}
      className={`relative w-64 overflow-hidden rounded-2xl p-4 text-center ${className}`}
      style={{ background: estilo.fundo, border: `2px solid ${estilo.borda}` }}
    >
      {/* Brilho de fundo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${estilo.brilho} 0%, transparent 55%)`,
        }}
      />
      {/* Marca d'água do escudo (mesmo efeito do ranking do mês) */}
      <img
        src={escudoUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-[85%] -translate-x-1/2 -translate-y-1/2 opacity-15"
        style={{ filter: filtroEscudo }}
      />
      <div className="relative">
        {/* Brasão do Fut Cajazeiras no topo */}
        <div className="flex justify-center">
          <img
            src={escudoUrl}
            alt="Fut Cajazeiras"
            className="size-10 rounded-full"
            style={{
              border: `1px solid ${estilo.borda}`,
              background: "rgba(0,0,0,0.35)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          />
        </div>

        {/* Linha superior: OVR e posição */}
        <div className="mt-2 flex items-start justify-between">
          <div className="text-left">
            <p
              className="font-display text-5xl font-bold leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
              style={{ color: estilo.texto }}
            >
              {ovr}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest opacity-80">
              <span style={{ color: estilo.texto }}>Nv {nivel}</span>
            </p>
          </div>
          <div className="text-right">
            <p
              className="font-display text-3xl font-bold uppercase leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
              style={{ color: estilo.texto }}
            >
              {posicaoSigla(posicao)}
            </p>
            <p
              className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ color: estilo.texto, border: `1px solid ${estilo.borda}` }}
            >
              {ROTULOS_TEMA[tema]}
            </p>
          </div>
        </div>

        {/* Foto do jogador */}
        <div className="mt-3 flex justify-center">
          <AvatarJogador caminho={fotoUrl} nome={nome} size="lg" />
        </div>

        {/* Nome */}
        <p
          className="mt-3 truncate font-display text-2xl font-bold uppercase leading-tight"
          style={{ color: estilo.texto, textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
        >
          {nome}
        </p>

        {/* Grid de atributos */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {SIGLAS_ATRIBUTO.map((sigla, i) => (
            <div
              key={sigla}
              className="rounded-lg px-1 py-1.5"
              style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${estilo.borda}66` }}
            >
              <p
                className="text-[9px] font-bold tracking-widest opacity-80"
                style={{ color: estilo.texto }}
              >
                {sigla}
              </p>
              <p
                className="font-display text-xl font-bold leading-none"
                style={{ color: estilo.texto }}
                title={ROTULOS_ATRIBUTO[sigla]}
              >
                {atributos[i]}
              </p>
            </div>
          ))}
        </div>

        {/* Rodapé: micro-badges (conquistas em destaque) */}
        <div className="mt-3 flex min-h-6 items-center justify-center gap-1">
          {conquistas.slice(0, 3).map((c) => (
            <span
              key={c.id}
              title={c.nome}
              className="text-lg drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
            >
              {c.icone}
            </span>
          ))}
          {conquistas.length === 0 && (
            <span
              className="text-[9px] uppercase tracking-widest opacity-60"
              style={{ color: estilo.texto }}
            >
              Sem conquistas em destaque
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
