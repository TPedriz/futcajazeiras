import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, CreditCard, ExternalLink, Loader2, QrCode, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { taxasPagamentoQuery } from "@/lib/babaQueries";
import { formatarReais } from "@/lib/redeSocial";
import {
  DESCRICAO_METODO,
  METODOS_PAGAMENTO,
  ROTULO_METODO,
  TAXAS_PADRAO,
  calcularCobranca,
  type DadosCobranca,
  type MetodoPagamento,
} from "@/lib/taxasPagamento";

interface PagamentoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
  /** Valor base da cobrança (sem taxa) — usado para montar as opções. */
  valorBase: number;
  /** Cobrança já criada. `null` mostra a escolha da forma de pagamento. */
  dados: DadosCobranca | null;
  carregando: boolean;
  pago: boolean;
  /** Escolha (ou troca) da forma de pagamento. Sem isso, não há escolha. */
  onEscolherMetodo?: (metodo: MetodoPagamento) => void;
  /** Mensagem de erro da geração da cobrança. */
  erro?: string | null;
}

const ICONE_METODO: Record<MetodoPagamento, React.ComponentType<{ className?: string }>> = {
  pix: QrCode,
  debito: CreditCard,
  credito: CreditCard,
};

/**
 * Diálogo único de pagamento do app.
 *
 * Fluxo: o usuário escolhe a forma de pagamento (PIX, cartão de débito ou de
 * crédito) → o valor cobrado é o valor base + a taxa da forma escolhida,
 * arredondada para cima → PIX mostra o QR Code e cartão abre o checkout
 * seguro do Mercado Pago (em outra aba), com confirmação automática aqui.
 */
export function PagamentoDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  valorBase,
  dados,
  carregando,
  pago,
  onEscolherMetodo,
  erro,
}: PagamentoDialogProps) {
  const [copiado, setCopiado] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const { data: taxas } = useQuery(taxasPagamentoQuery());
  const percentuais = taxas ?? TAXAS_PADRAO;

  // Volta para a escolha sempre que o diálogo abre de novo.
  useEffect(() => {
    if (open) setTrocando(false);
  }, [open]);

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

  const escolhendo = !pago && !!onEscolherMetodo && (trocando || !dados);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{pago ? "Pagamento confirmado!" : titulo}</DialogTitle>
          <DialogDescription>
            {pago
              ? "Tudo certo, já atualizamos aqui no app."
              : escolhendo
                ? "Escolha como quer pagar. A taxa da forma escolhida já está incluída no valor."
                : descricao}
          </DialogDescription>
        </DialogHeader>

        {pago ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex size-20 items-center justify-center rounded-full bg-success/15">
              <Check className="size-10 text-success" />
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="size-4 text-success" /> Pagamento recebido
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-success" /> Status atualizado
              </li>
            </ul>
            <Button variant="hero" className="mt-2 w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : escolhendo ? (
          <div className="space-y-3">
            <div className="space-y-2">
              {METODOS_PAGAMENTO.map((metodo) => {
                const opcao = calcularCobranca(valorBase, percentuais[metodo] ?? 0);
                const Icone = ICONE_METODO[metodo];
                return (
                  <button
                    key={metodo}
                    type="button"
                    disabled={carregando}
                    onClick={() => {
                      setTrocando(false);
                      onEscolherMetodo?.(metodo);
                    }}
                    className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-surface p-3 text-left transition-colors hover:border-gold/60 hover:bg-gold/5 disabled:opacity-60"
                  >
                    <Icone className="mt-0.5 size-5 shrink-0 text-gold" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {ROTULO_METODO[metodo]}
                        </span>
                        <span className="shrink-0 font-display text-lg text-gold">
                          {formatarReais(opcao.total)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {DESCRICAO_METODO[metodo]}
                      </span>
                      {opcao.taxa > 0 && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatarReais(opcao.valorBase)} + taxa de{" "}
                          {opcao.taxaPercentual.toLocaleString("pt-BR", {
                            maximumFractionDigits: 2,
                          })}
                          % ({formatarReais(opcao.taxa)})
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {erro && <p className="text-center text-xs text-destructive">{erro}</p>}
            {carregando && (
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Gerando cobrança...
              </p>
            )}
          </div>
        ) : carregando || !dados ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-gold" />
            Gerando cobrança...
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center font-display text-3xl text-gold">
              {formatarReais(dados.valor)}
            </p>

            {dados.taxa > 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                {formatarReais(dados.valorBase)} + taxa de {formatarReais(dados.taxa)} (
                {dados.taxaPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%) —{" "}
                {ROTULO_METODO[dados.metodo]}
              </p>
            )}

            {dados.metodo === "pix" ? (
              <>
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
                  {copiado ? (
                    <>
                      <Check className="size-4" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" /> Copiar código PIX
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {dados.checkoutUrl ? (
                  <a
                    href={dados.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="gold" size="lg" className="w-full">
                      <ExternalLink className="size-4" /> Abrir pagamento no Mercado Pago
                    </Button>
                  </a>
                ) : (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-center text-xs text-destructive">
                    Não foi possível montar o link do checkout. Tente novamente.
                  </p>
                )}
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  O pagamento abre em outra aba, com cartão de crédito (até 3x com juros) ou débito.
                  Pode voltar para cá depois — a confirmação é automática.
                </p>
              </>
            )}

            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Aguardando confirmação do pagamento...
            </p>

            {onEscolherMetodo && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setTrocando(true)}
              >
                <ArrowLeft className="size-3" /> Trocar forma de pagamento
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
