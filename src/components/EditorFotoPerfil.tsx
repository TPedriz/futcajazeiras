import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Move, ZoomIn, Loader2 } from "lucide-react";

interface EditorFotoPerfilProps {
  arquivo: File | null;
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  /** Recebe o recorte final pronto (Blob) para o fluxo de upload. */
  onSalvar: (blob: Blob) => Promise<void>;
}

const EXIBICAO = 288; // tamanho do preview em px
const SAIDA = 512; // tamanho da imagem gerada

/** Editor: reposicionar (arrastar), dar zoom e ver o preview antes de salvar. */
export function EditorFotoPerfil({
  arquivo,
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

  // Carrega o arquivo escolhido para o editor.
  useEffect(() => {
    if (!arquivo) return;
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      setImagem(img);
      setZoom(1);
      setDx(0);
      setDy(0);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const escalaBase = imagem
    ? Math.max(EXIBICAO / imagem.naturalWidth, EXIBICAO / imagem.naturalHeight)
    : 1;

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

  // Gera o recorte final (quadrado 512px com a região visível no preview).
  const gerarRecorte = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      if (!imagem) return resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = SAIDA;
      canvas.height = SAIDA;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      const fator = SAIDA / EXIBICAO;
      const escala = escalaBase * zoom;
      const largura = imagem.naturalWidth * escala;
      const altura = imagem.naturalHeight * escala;
      ctx.drawImage(
        imagem,
        (SAIDA - largura) / 2 + dx * fator,
        (SAIDA - altura) / 2 + dy * fator,
        largura,
        altura,
      );
      canvas.toBlob(resolve, "image/jpeg", 0.92);
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
      /* o toast de erro é tratado pelo fluxo de upload */
      throw e;
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
          {imagem && (
            <img
              src={imagem.src}
              alt="Pré-visualização da foto de perfil"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: imagem.naturalWidth * escalaBase * zoom,
                height: imagem.naturalHeight * escalaBase * zoom,
                transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
              }}
            />
          )}
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
