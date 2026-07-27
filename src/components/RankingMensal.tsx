import { useQuery } from "@tanstack/react-query";
import { rankingDoMesQuery, mesReferencia } from "@/lib/babaQueries";
import { Trophy, Goal, Medal, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LinhaRanking {
  nome: string;
  gols: number;
  vitorias: number;
  derrotas: number;
}

/** Desenha o ranking num canvas e devolve o PNG. */
function desenharRanking(mes: string, linhas: LinhaRanking[]): Promise<Blob | null> {
  const L = 1080;
  const A = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const fundo = ctx.createLinearGradient(0, 0, L, A);
  fundo.addColorStop(0, "#0b0b0d");
  fundo.addColorStop(1, "#1a0d0f");
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);

  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, L - 60, A - 60);

  ctx.textAlign = "center";
  ctx.fillStyle = "#c9a227";
  ctx.font = "bold 40px Inter, system-ui, sans-serif";
  ctx.fillText("FUT CAJAZEIRAS", L / 2, 140);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 84px Inter, system-ui, sans-serif";
  ctx.fillText("RANKING DO MÊS", L / 2, 240);
  ctx.fillStyle = "#c9a227";
  ctx.font = "48px Inter, system-ui, sans-serif";
  ctx.fillText(mes.toUpperCase(), L / 2, 310);

  let y = 420;
  ctx.textAlign = "left";
  linhas.forEach((r, i) => {
    ctx.fillStyle = i === 0 ? "rgba(201,162,39,0.14)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(80, y - 60, L - 160, 130);
    ctx.fillStyle = i === 0 ? "#c9a227" : "#8c8c92";
    ctx.font = "bold 64px Inter, system-ui, sans-serif";
    ctx.fillText(`${i + 1}`, 120, y + 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px Inter, system-ui, sans-serif";
    ctx.fillText(r.nome.slice(0, 20), 220, y + 5);
    ctx.fillStyle = "#8c8c92";
    ctx.font = "34px Inter, system-ui, sans-serif";
    ctx.fillText(`${r.vitorias}V · ${r.derrotas}D`, 220, y + 50);
    ctx.fillStyle = "#c9a227";
    ctx.font = "bold 56px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${r.gols} ⚽`, L - 120, y + 25);
    ctx.textAlign = "left";
    y += 160;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#8c8c92";
  ctx.font = "32px Inter, system-ui, sans-serif";
  ctx.fillText("futcajazeiras.lovable.app", L / 2, A - 90);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function RankingMensal() {
  const referencia = mesReferencia();
  const { data, isLoading } = useQuery(rankingDoMesQuery(referencia));

  const top = [...(data ?? [])]
    .sort(
      (a, b) =>
        (b.gols ?? 0) - (a.gols ?? 0) ||
        (b.vitorias ?? 0) - (a.vitorias ?? 0) ||
        (a.derrotas ?? 0) - (b.derrotas ?? 0),
    )
    .slice(0, 5);

  const mesTexto = format(new Date(`${referencia}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR });

  const exportarImagem = async () => {
    if (top.length === 0) return;
    const blob = await desenharRanking(
      mesTexto,
      top.map((r) => ({
        nome: r.nome ?? "Jogador",
        gols: r.gols ?? 0,
        vitorias: r.vitorias ?? 0,
        derrotas: r.derrotas ?? 0,
      })),
    );
    if (!blob) {
      toast.error("Não foi possível gerar a imagem");
      return;
    }
    const arquivo = new File([blob], `ranking-fut-cajazeiras-${referencia}.png`, { type: "image/png" });
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

      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando ranking...</p>}


      {!isLoading && top.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ainda não há gols nem resultados lançados neste mês.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {top.map((r, i) => (
          <li key={r.usuario_id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${
                i === 0 ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
              }`}
            >
              {i === 0 ? <Medal className="size-4" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.nome}</span>
            <span className="flex items-center gap-1 text-sm text-gold">
              <Goal className="size-3.5" /> {r.gols ?? 0}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              <strong className="text-foreground">{r.vitorias ?? 0}</strong>V ·{" "}
              <strong className="text-foreground">{r.derrotas ?? 0}</strong>D
            </span>
            <span className="flex items-center gap-0.5">
              {(r.cartoes_amarelos ?? 0) > 0 && (
                <span className="rounded-sm bg-yellow-400 px-1 text-[9px] font-bold text-black">
                  {r.cartoes_amarelos}
                </span>
              )}
              {(r.cartoes_azuis ?? 0) > 0 && (
                <span className="rounded-sm bg-blue-500 px-1 text-[9px] font-bold text-white">{r.cartoes_azuis}</span>
              )}
              {(r.cartoes_vermelhos ?? 0) > 0 && (
                <span className="rounded-sm bg-destructive px-1 text-[9px] font-bold text-white">
                  {r.cartoes_vermelhos}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
