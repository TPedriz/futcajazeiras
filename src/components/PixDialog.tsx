import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, Loader2, QrCode } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface DadosPix {
  qrCode: string | null;
  qrBase64: string | null;
  valor: number;
}

interface PixDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
  dados: DadosPix | null;
  carregando: boolean;
  pago: boolean;
}

export function PixDialog({ open, onOpenChange, titulo, descricao, dados, carregando, pago }: PixDialogProps) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!dados?.qrCode) return;
    try {
      await navigator.clipboard.writeText(dados.qrCode);
      setCopiado(true);
      toast.success("Código PIX copiado");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não foi possível copiar", { description: "Selecione o código manualmente." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{pago ? "Pagamento confirmado!" : titulo}</DialogTitle>
          <DialogDescription>
            {pago ? "Tudo certo, já atualizamos aqui no app." : descricao}
          </DialogDescription>
        </DialogHeader>

        {pago ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex size-20 items-center justify-center rounded-full bg-success/15">
              <Check className="size-10 text-success" />
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> PIX recebido</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> Status atualizado</li>
            </ul>
            <Button variant="hero" className="mt-2 w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : carregando || !dados ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-gold" />
            Gerando cobrança PIX...
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center font-display text-3xl text-gold">
              R$ {dados.valor.toFixed(2).replace(".", ",")}
            </p>

            {dados.qrBase64 ? (
              <img
                src={`data:image/png;base64,${dados.qrBase64}`}
                alt="QR Code do PIX para pagamento"
                className="mx-auto size-56 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="mx-auto flex size-56 items-center justify-center rounded-lg border border-border">
                <QrCode className="size-10 text-muted-foreground" />
              </div>
            )}

            <p className="break-all rounded-lg border border-border bg-surface p-3 text-[10px] leading-relaxed text-muted-foreground">
              {dados.qrCode}
            </p>

            <Button variant="gold" size="lg" className="w-full" onClick={copiar}>
              {copiado ? <><Check className="size-4" /> Copiado</> : <><Copy className="size-4" /> Copiar código PIX</>}
            </Button>

            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Aguardando confirmação do pagamento...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
