import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Move, ZoomIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditorFotoPerfilProps {
  /** Arquivo novo (File) OU URL assinada da foto já salva (string). */
  origem: File | string | null;
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  /** Recebe o recorte final pronto (Blob) para o fluxo de upload. */
  onSalvar: (blob: Blob) => Promise<void>;
}

const EXIBICAO = 288; // tamanho do preview em px
const SAIDA = 512; // tamanho da imagem gerada

/** Editor: reposicionar (arrastar), dar zoom e ver o preview antes de salvar. */
export function EditorFotoPerfil({
  origem,
  aberto,
  onAbertoChange,
  onSalvar,
}: EditorFotoPerfilProps) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const arrastando = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const canvasPreview = useRef<HTMLCanvasElement | null>(null);

  // Carrega a origem (arquivo novo ou URL da foto atual) para o editor.
  // URLs cross-origin (storage) são baixadas como blob local para não contaminar o canvas.
  useEffect(() => {
    if (!origem || !aberto) return;
    let objectUrl: string | null = null;
    let cancelado = false;

    const carregar = async () => {
      try {
        if (typeof origem === "string") {
          const resposta = await fetch(origem);
          if (!resposta.ok) throw new Error("Falha ao baixar a foto");
          const blob = await resposta.blob();
          if (cancelado) return;
          objectUrl = URL.createObjectURL(blob);
        } else {
          objectUrl = URL.createObjectURL(origem);
        }
        const img = new Image();
        img.onload = () => {
          if (cancelado) return;
          setImagem(img);
          setZoom(1);
          setDx(0);
          setDy(0);
        };
        img.onerror = () => {
          if (!cancelado) setImagem(null);
        };
        img.src = objectUrl;
      } catch {
        if (!cancelado) setImagem(null);
      }
    };

    carregar();
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setImagem(null);
    };
  }, [origem, aberto]);

  const escalaBase = imagem
    ? Math.max(EXIBICAO / imagem.naturalWidth, EXIBICAO / imagem.naturalHeight)
    : 1;

  // Desenha a imagem recortada num canvas do tamanho pedido.
  // O MESMO cálculo é usado para o preview e para a imagem final,
  // então o que aparece no círculo é exatamente o que é salvo.
  const desenharCanvas = (tamanho: number): HTMLCanvasElement | null => {
    if (!imagem) return null;
    const canvas = document.createElement("canvas");
    canvas.width = tamanho;
    canvas.height = tamanho;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const fator = tamanho / EXIBICAO;
    const escala = escalaBase * zoom;
    const largura = imagem.naturalWidth * escala;
    const altura = imagem.naturalHeight * escala;
    ctx.drawImage(
      imagem,
      (tamanho - largura) / 2 + dx * fator,
      (tamanho - altura) / 2 + dy * fator,
      largura,
      altura,
    );
    return canvas;
  };

  // Redesenha o preview sempre que imagem/zoom/posição mudam.
  useEffect(() => {
    const alvo = canvasPreview.current;
    if (!alvo) return;
    const ctx = alvo.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, EXIBICAO, EXIBICAO);
    if (!imagem) return;
    const desenhado = desenharCanvas(EXIBICAO);
    if (desenhado) ctx.drawImage(desenhado, 0, 0);
  });

  // Eventos de arrastar para reposicionar.
  const aoPressionar = (e: React.PointerEvent) => {
    arrastando.current = { x: e.clientX, y: e.clientY, dx, dy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const aoMover = (e: React.PointerEvent) => {
    if (!arrastando.current || !imagem) return;
    const base = arrastando.current;
    setDx(base.dx + (e.clientX - base.x));
    setDy(base.dy + (e.clientY - base.y));
  };
  const aoSoltar = () => {
    arrastando.current = null;
  };

  // Gera o recorte final (quadrado 512px) usando o mesmo cálculo do preview.
  const gerarRecorte = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      try {
        const canvas = desenharCanvas(SAIDA);
        if (!canvas) return resolve(null);
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      } catch {
        resolve(null);
      }
    });

  const salvar = async () => {
    if (!imagem) return;
    setSalvando(true);
    try {
      const blob = await gerarRecorte();
      if (!blob) throw new Error("Não foi possível gerar a imagem");
      await onSalvar(blob);
      onAbertoChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar a foto", {
        description: (e as Error).message,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Ajustar foto de perfil</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Arraste a imagem para reposicionar e use o controle para dar zoom. O círculo mostra
          exatamente como a foto vai ficar.
        </p>

        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-full border-2 border-gold/50"
          style={{ width: EXIBICAO, height: EXIBICAO }}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
        >
          <canvas
            ref={canvasPreview}
            width={EXIBICAO}
            height={EXIBICAO}
            className="block h-full w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <Move className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-[11px] text-muted-foreground">
            Arraste para reposicionar
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ZoomIn className="size-4 shrink-0 text-gold" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            aria-label="Zoom da foto"
            onValueChange={([v]) => setZoom(v)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => onAbertoChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="gold"
            size="lg"
            className="flex-1"
            disabled={!imagem || salvando}
            onClick={salvar}
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : null} Salvar foto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
