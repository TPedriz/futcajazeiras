import { useQuery } from "@tanstack/react-query";
import { rankingDoMesQuery, mesReferencia, perfisPublicosQuery } from "@/lib/babaQueries";
import { Trophy, Goal, Handshake, ShieldCheck, ImageDown, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AvatarJogador } from "@/components/AvatarJogador";
import { BadgeDestaque } from "@/components/BadgeDestaque";
import { destaquesDoUsuario, iconeDestaque, type Destaque } from "@/lib/gamificacao";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import escudoAsset from "@/assets/fut-cajazeiras-escudo.png.asset.json";

const escudo = escudoAsset.url;

type Categoria = "gols" | "assistencias" | "penaltis" | "cartoes";

const CATEGORIAS: { id: Categoria; rotulo: string; Icone: typeof Goal; cor: string }[] = [
  { id: "gols", rotulo: "Gols", Icone: Goal, cor: "text-gold" },
  { id: "assistencias", rotulo: "Assistências", Icone: Handshake, cor: "text-success" },
  { id: "penaltis", rotulo: "Pênaltis defendidos", Icone: ShieldCheck, cor: "text-violet-400" },
  { id: "cartoes", rotulo: "Cartões", Icone: Medal, cor: "text-destructive" },
];

interface LinhaImagem {
  nome: string;
  valor: string;
  avatar: HTMLImageElement | null;
  destaques: Destaque[];
}

const MEDALHA_CANVAS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

/** Desenha o ranking num canvas e devolve o PNG. */
function carregarEscudo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = escudo;
  });
}

/** Carrega a foto de perfil (URL assinada) para desenhar no canvas. */
async function carregarAvatar(caminho: string | null): Promise<HTMLImageElement | null> {
  if (!caminho) return null;
  try {
    const { data } = await supabase.storage.from("avatares").createSignedUrl(caminho, 60 * 60);
    if (!data?.signedUrl) return null;
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = data.signedUrl;
    });
  } catch {
    return null;
  }
}

async function desenharRanking(
  mes: string,
  categoria: string,
  linhas: LinhaImagem[],
): Promise<Blob | null> {
  const L = 1080;
  const A = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const fundo = ctx.createLinearGradient(0, 0, L, A);
  fundo.addColorStop(0, "#0b0b0d");
  fundo.addColorStop(1, "#1a0d0f");
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);

  const brasao = await carregarEscudo();
  if (brasao) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    const tam = L * 0.85;
    ctx.drawImage(brasao, (L - tam) / 2, (A - tam) / 2, tam, tam);
    ctx.restore();
  }

  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, L - 60, A - 60);

  ctx.textAlign = "center";
  ctx.fillStyle = "#c9a227";
  ctx.font = "bold 40px Inter, system-ui, sans-serif";
  ctx.fillText("FUT CAJAZEIRAS", L / 2, 190);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 84px Inter, system-ui, sans-serif";
  ctx.fillText("RANKING DO MÊS", L / 2, 272);
  ctx.fillStyle = "#c9a227";
  ctx.font = "44px Inter, system-ui, sans-serif";
  ctx.fillText(`${mes.toUpperCase()} · ${categoria.toUpperCase()}`, L / 2, 334);

  let y = 452;
  ctx.textAlign = "left";
  linhas.forEach((r, i) => {
    ctx.fillStyle = i === 0 ? "rgba(201,162,39,0.14)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(70, y - 62, L - 140, 135);

    // Foto de perfil ao lado do nome (círculo).
    if (r.avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(172, y + 5, 46, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(r.avatar, 126, y - 41, 92, 92);
      ctx.restore();
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(172, y + 5, 46, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(201,162,39,0.18)";
      ctx.beginPath();
      ctx.arc(172, y + 5, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9a227";
      ctx.font = "bold 40px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(i === 0 ? "★" : String(i + 1), 172, y + 15);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = i === 0 ? "#c9a227" : "#8c8c92";
    ctx.font = "bold 64px Inter, system-ui, sans-serif";
    ctx.fillText(`${i + 1}`, 245, y + 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px Inter, system-ui, sans-serif";
    ctx.fillText(r.nome.slice(0, 20), 310, y + 5);

    // Badges de destaque (medalha + ícone da categoria) ao lado do nome.
    const nomeW = ctx.measureText(r.nome.slice(0, 20)).width;
    let bx = 310 + nomeW + 26;
    ctx.font = "30px Inter, system-ui, sans-serif";
    for (const d of r.destaques) {
      const txt = `${MEDALHA_CANVAS[d.posicao] ?? d.posicao} ${iconeDestaque(d.categoria)}`;
      const w = ctx.measureText(txt).width + 36;
      if (bx + w > L - 130) break;
      ctx.fillStyle =
        d.posicao === 1
          ? "rgba(201,162,39,0.30)"
          : d.posicao === 2
            ? "rgba(148,163,184,0.28)"
            : "rgba(217,119,6,0.28)";
      const pH = 54;
      const pY = y - 30;
      const rr = pH / 2;
      ctx.beginPath();
      ctx.moveTo(bx + rr, pY);
      ctx.arcTo(bx + w, pY, bx + w, pY + pH, rr);
      ctx.arcTo(bx + w, pY + pH, bx, pY + pH, rr);
      ctx.arcTo(bx, pY + pH, bx, pY, rr);
      ctx.arcTo(bx, pY, bx + w, pY, rr);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(txt, bx + 18, y + 4);
      bx += w + 12;
    }

    ctx.fillStyle = "#8c8c92";
    ctx.font = "30px Inter, system-ui, sans-serif";
    ctx.fillText(categoria, 310, y + 42);
    ctx.fillStyle = "#c9a227";
    ctx.font = "bold 58px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(r.valor, L - 110, y + 20);
    ctx.textAlign = "left";
    y += 165;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#8c8c92";
  ctx.font = "32px Inter, system-ui, sans-serif";
  ctx.fillText("futcajazeiras.lovable.app", L / 2, A - 90);

  if (brasao) ctx.drawImage(brasao, L / 2 - 55, 40, 110, 110);

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

interface LinhaRanking {
  usuario_id: string | null;
  nome: string | null;
  gols: number | null;
  assistencias: number | null;
  penaltis_defendidos: number | null;
  vitorias: number | null;
  derrotas: number | null;
  empates: number | null;
  cartoes_amarelos: number | null;
  cartoes_azuis: number | null;
  cartoes_vermelhos: number | null;
}

export function RankingMensal() {
  const referencia = mesReferencia();
  const { data, isLoading } = useQuery(rankingDoMesQuery(referencia));
  const { data: perfis } = useQuery(perfisPublicosQuery());
  const [categoria, setCategoria] = useState<Categoria>("gols");
  const avatarDe = (id: string | null) =>
    (perfis ?? []).find((p) => p.id === id)?.avatar_url ?? null;

  const totalCartoes = (r: LinhaRanking) =>
    (r.cartoes_amarelos ?? 0) + (r.cartoes_azuis ?? 0) + (r.cartoes_vermelhos ?? 0);

  const valorDe = (r: LinhaRanking): number => {
    if (categoria === "gols") return r.gols ?? 0;
    if (categoria === "assistencias") return r.assistencias ?? 0;
    if (categoria === "penaltis") return r.penaltis_defendidos ?? 0;
    return totalCartoes(r);
  };

  // Cartões sozinhos NÃO colocam ninguém no ranking das demais categorias:
  // cada categoria exige valor > 0 na própria métrica.
  const top = [...(data ?? [])]
    .filter((r) => valorDe(r) > 0)
    .sort((a, b) => valorDe(b) - valorDe(a) || (b.gols ?? 0) - (a.gols ?? 0))
    .slice(0, 5);

  const mesTexto = format(new Date(`${referencia}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR });
  const categoriaAtual = CATEGORIAS.find((c) => c.id === categoria);

  const exportarImagem = async () => {
    if (top.length === 0) return;
    const linhas: LinhaImagem[] = [];
    for (const r of top) {
      const avatar = await carregarAvatar(avatarDe(r.usuario_id));
      linhas.push({
        nome: r.nome ?? "Jogador",
        valor: String(valorDe(r)),
        avatar,
        destaques: destaquesDoUsuario(data ?? [], r.usuario_id, 3),
      });
    }
    const blob = await desenharRanking(mesTexto, categoriaAtual?.rotulo ?? "Gols", linhas);
    if (!blob) {
      toast.error("Não foi possível gerar a imagem");
      return;
    }
    const arquivo = new File([blob], `ranking-fut-cajazeiras-${referencia}-${categoria}.png`, {
      type: "image/png",
    });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: "Ranking Fut Cajazeiras" });
        return;
      } catch {
        /* usuário cancelou: cai no download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivo.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Imagem do ranking salva!");
  };

  return (
    <section className="card-premium p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Ranking do mês</p>
          <h2 className="font-display text-2xl capitalize">
            {format(new Date(`${referencia}T12:00:00`), "MMMM", { locale: ptBR })}
          </h2>
        </div>
        <Trophy className="size-6 text-gold" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {CATEGORIAS.map(({ id, rotulo, Icone, cor }) => (
          <Button
            key={id}
            variant={categoria === id ? "gold" : "outline"}
            size="sm"
            onClick={() => setCategoria(id)}
          >
            <Icone className={`size-4 ${categoria === id ? "" : cor}`} /> {rotulo}
          </Button>
        ))}
      </div>

      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando ranking...</p>}

      {!isLoading && top.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ainda não há dados lançados nesta categoria neste mês.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {top.map((r, i) => {
          const Icone = categoriaAtual?.Icone ?? Goal;
          return (
            <li
              key={r.usuario_id}
              className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${
                  i === 0 ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
                }`}
              >
                {i === 0 ? <Medal className="size-4" /> : i + 1}
              </span>
              <AvatarJogador caminho={avatarDe(r.usuario_id)} nome={r.nome} size="sm" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="truncate text-sm font-semibold">{r.nome}</span>
                <BadgeDestaque usuarioId={r.usuario_id} />
              </span>
              {categoria === "cartoes" ? (
                <span className="flex items-center gap-1">
                  {(r.cartoes_amarelos ?? 0) > 0 && (
                    <span className="rounded-sm bg-yellow-400 px-1 text-[9px] font-bold text-black">
                      {r.cartoes_amarelos}
                    </span>
                  )}
                  {(r.cartoes_azuis ?? 0) > 0 && (
                    <span className="rounded-sm bg-blue-500 px-1 text-[9px] font-bold text-white">
                      {r.cartoes_azuis}
                    </span>
                  )}
                  {(r.cartoes_vermelhos ?? 0) > 0 && (
                    <span className="rounded-sm bg-destructive px-1 text-[9px] font-bold text-white">
                      {r.cartoes_vermelhos}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-gold">
                  <Icone className="size-3.5" /> {valorDe(r)}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {top.length > 0 && (
        <Button variant="goldOutline" size="lg" className="mt-4 w-full" onClick={exportarImagem}>
          <ImageDown className="size-4" /> Compartilhar ranking como imagem
        </Button>
      )}
    </section>
  );
}
