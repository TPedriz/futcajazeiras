import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PagamentoDialog } from "@/components/PagamentoDialog";
import { criarPixMeta, consultarPixMeta } from "@/lib/metas.functions";
import type { DadosCobranca, MetodoPagamento } from "@/lib/taxasPagamento";
import { formatarReais } from "@/lib/redeSocial";
import { HeartHandshake, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SUGESTOES = [10, 20, 50, 100];

/**
 * Diálogo de contribuição para uma meta coletiva.
 * Fluxo: valor + anonimato -> PIX (Mercado Pago) -> confirmação -> arrecadação.
 * Só aumenta a meta quando o pagamento é confirmado (webhook/polling).
 */
export function ContribuicaoDialog({
  meta,
  aberto,
  onAbertoChange,
}: {
  meta: { id: string; titulo: string; status: string } | null;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("20");
  const [anonima, setAnonima] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [pix, setPix] = useState<DadosCobranca | null>(null);
  const [contribuicaoId, setContribuicaoId] = useState<string | null>(null);
  const [valorBase, setValorBase] = useState(0);
  const [pixTitulo, setPixTitulo] = useState("");
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pixAberto, setPixAberto] = useState(false);

  const cobrar = useMutation({
    mutationFn: async (metodo: MetodoPagamento) => {
      if (!contribuicaoId) throw new Error("Contribuição não encontrada");
      setPix(null);
      setPago(false);
      setErro(null);
      return await criarPixMeta({ data: { contribuicaoId, metodo } });
    },
    onSuccess: (r) => {
      if (r.pago) {
        setPago(true);
        return;
      }
      setPix(r);
    },
    onError: (e: Error) => {
      setErro(e.message);
      toast.error("Não foi possível gerar a cobrança", { description: e.message });
    },
  });

  // Polling enquanto há cobrança aberta (mesmo padrão da mensalidade).
  useEffect(() => {
    if (!pixAberto || !contribuicaoId || pago || !pix) return;
    const id = setInterval(async () => {
      try {
        const r = await consultarPixMeta({ data: { contribuicaoId } });
        if (r.pago) {
          setPago(true);
          clearInterval(id);
          toast.success("Contribuição confirmada!", {
            description: "Obrigado por apoiar a meta da comunidade!",
          });
          void qc.invalidateQueries({ queryKey: ["metas"] });
          void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
          void qc.invalidateQueries({ queryKey: ["feed-global"] });
        }
      } catch {
        /* ignora — o polling continua */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [pixAberto, contribuicaoId, pago, pix, qc]);

  const fechar = () => {
    setPixAberto(false);
    setPix(null);
    setContribuicaoId(null);
    setPago(false);
    setGerando(false);
    setErro(null);
    setValorBase(0);
    setValor("20");
    setAnonima(false);
    onAbertoChange(false);
  };

  const confirmar = async () => {
    if (!meta) return;
    const valorNumero = Number(valor.replace(",", "."));
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setGerando(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão expirada.");

      // 1. Registra a contribuição pendente (valor livre — arrecadação aberta).
      const { data: contribuicao, error } = await supabase
        .from("contribuicoes_meta")
        .insert({
          meta_id: meta.id,
          user_id: userData.user.id,
          valor: valorNumero,
          anonima,
          status: "pendente",
        })
        .select("id")
        .single();
      if (error) throw error;

      // 2. Abre o pagamento: a forma (PIX ou cartão) é escolhida antes da cobrança.
      setContribuicaoId(contribuicao.id);
      setPixTitulo(`Contribuição — ${meta.titulo}`);
      setValorBase(valorNumero);
      setPix(null);
      setPago(false);
      setErro(null);
      setGerando(false);
      setPixAberto(true);
    } catch (e) {
      setGerando(false);
      toast.error("Não foi possível iniciar a contribuição", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    }
  };

  return (
    <>
      <Dialog open={aberto && !!meta} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartHandshake className="size-5 text-gold" /> Contribuir
            </DialogTitle>
            <DialogDescription>
              {meta?.titulo ?? ""} — sua contribuição ajuda a comunidade. A meta só aumenta quando o
              pagamento é confirmado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Sugestões rápidas */}
            <div className="grid grid-cols-4 gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValor(String(s))}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                    valor === String(s)
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-border/60 bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  R$ {s}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="valor-contribuicao">Valor (R$)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor-contribuicao"
                  type="number"
                  min={1}
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Contribuição anônima</p>
                <p className="text-[11px] text-muted-foreground">
                  Aparece como "Contribuição anônima" no histórico.
                </p>
              </div>
              <Switch checked={anonima} onCheckedChange={setAnonima} />
            </div>

            <Button
              variant="gold"
              size="lg"
              className="w-full"
              disabled={gerando}
              onClick={confirmar}
            >
              {gerando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <HeartHandshake className="size-4" />
              )}
              Contribuir {formatarReais(Number(valor) || 0)}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              Pague com PIX ou cartão. A contribuição só entra na arrecadação após a confirmação.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <PagamentoDialog
        open={pixAberto}
        onOpenChange={(v) => {
          setPixAberto(v);
          if (!v) {
            void qc.invalidateQueries({ queryKey: ["metas"] });
            void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
            fechar();
          }
        }}
        titulo={pixTitulo}
        descricao="Escaneie o QR Code ou copie o código PIX para pagar."
        valorBase={valorBase}
        dados={pix}
        carregando={cobrar.isPending}
        pago={pago}
        erro={erro}
        onEscolherMetodo={(metodo) => cobrar.mutate(metodo)}
      />
    </>
  );
}
