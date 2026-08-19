import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PixDialog, type DadosPix } from "@/components/PixDialog";
import { criarPixMeta, consultarPixMeta } from "@/lib/metas.functions";
import { formatarReais, rotuloTipoArrecadacao, TAMANHOS_CAMISA } from "@/lib/redeSocial";
import { supabase } from "@/integrations/supabase/client";
import { Shirt, Loader2, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Meta = Database["public"]["Tables"]["metas"]["Row"];

/**
 * Cadastro de interesse em arrecadação por item (ex.: coletes personalizados).
 *
 * Fluxo:
 *  1. Usuário preenche nome na camisa, tamanho e número.
 *  2. RPC `cadastrar_interesse_item` cria a contribuição com o custo fixo.
 *  3. Gera o PIX e aguarda a confirmação (polling, mesmo padrão da mensalidade).
 */
export function CadastroItemMetaDialog({
  meta,
  aberto,
  onAbertoChange,
}: {
  meta: Meta | null;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  const qc = useQueryClient();
  const [nomeCamisa, setNomeCamisa] = useState("");
  const [tamanho, setTamanho] = useState<string>("");
  const [numeroCamisa, setNumeroCamisa] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [pix, setPix] = useState<DadosPix | null>(null);
  const [contribuicaoId, setContribuicaoId] = useState<string | null>(null);
  const [pago, setPago] = useState(false);
  const [pixAberto, setPixAberto] = useState(false);

  const valorItem = Number(meta?.valor_item ?? 0);
  const prazoCadastro = meta?.prazo_cadastro ? new Date(`${meta.prazo_cadastro}T12:00:00`) : null;
  const prazoPagamento = meta?.prazo_pagamento
    ? new Date(`${meta.prazo_pagamento}T12:00:00`)
    : null;

  // Polling enquanto o PIX está aberto.
  useEffect(() => {
    if (!pixAberto || !contribuicaoId || pago) return;
    const id = setInterval(async () => {
      try {
        const r = await consultarPixMeta({ data: { contribuicaoId } });
        if (r.pago) {
          setPago(true);
          clearInterval(id);
          toast.success("Pagamento confirmado!", {
            description: "Seu cadastro está confirmado. Obrigado!",
          });
          void qc.invalidateQueries({ queryKey: ["metas"] });
          void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
          void qc.invalidateQueries({ queryKey: ["minhas-contribuicoes"] });
          void qc.invalidateQueries({ queryKey: ["feed-global"] });
        }
      } catch {
        /* ignora — o polling continua */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [pixAberto, contribuicaoId, pago, qc]);

  const fechar = () => {
    setPixAberto(false);
    setPix(null);
    setContribuicaoId(null);
    setPago(false);
    setCadastrando(false);
    setNomeCamisa("");
    setTamanho("");
    setNumeroCamisa("");
    onAbertoChange(false);
  };

  const cadastrar = async () => {
    if (!meta) return;
    if (!nomeCamisa.trim() || !tamanho || !numeroCamisa.trim()) {
      toast.error("Preencha nome, tamanho e número da camisa.");
      return;
    }
    setCadastrando(true);
    try {
      // 1. Cadastra o interesse (custo fixo definido pela diretoria).
      const { data: contribuicaoIdNovo, error } = await supabase.rpc("cadastrar_interesse_item", {
        p_meta_id: meta.id,
        p_nome_camisa: nomeCamisa.trim(),
        p_tamanho: tamanho,
        p_numero_camisa: numeroCamisa.trim(),
      });
      if (error) throw error;
      if (!contribuicaoIdNovo) throw new Error("Não foi possível cadastrar.");

      // 2. Gera o PIX para a contribuição.
      const r = await criarPixMeta({ data: { contribuicaoId: contribuicaoIdNovo } });
      setPix({ qrCode: r.qrCode, qrBase64: r.qrBase64, valor: r.valor });
      setContribuicaoId(r.contribuicaoId);
      setCadastrando(false);
      setPixAberto(true);
      void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
    } catch (e) {
      setCadastrando(false);
      toast.error("Não foi possível cadastrar", {
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
              <Shirt className="size-5 text-gold" /> {meta?.titulo ?? "Item"}
            </DialogTitle>
            <DialogDescription>
              {rotuloTipoArrecadacao(meta?.tipo_arrecadacao)} —{" "}
              <strong className="text-gold">{formatarReais(valorItem)}</strong> por item
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Prazos */}
            <div className="rounded-xl border border-border/60 bg-surface p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-gold" />
                <span>
                  Cadastro até{" "}
                  <strong className="text-foreground">
                    {prazoCadastro ? format(prazoCadastro, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </strong>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <CalendarClock className="size-4 text-gold" />
                <span>
                  Pagamento até{" "}
                  <strong className="text-foreground">
                    {prazoPagamento ? format(prazoPagamento, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </strong>
                </span>
              </div>
            </div>

            {/* Formulário de personalização */}
            <div className="space-y-1">
              <Label htmlFor="item-nome-camisa">Nome na camisa *</Label>
              <Input
                id="item-nome-camisa"
                value={nomeCamisa}
                onChange={(e) => setNomeCamisa(e.target.value)}
                placeholder="Ex.: THIAGO"
                maxLength={20}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-tamanho">Tamanho *</Label>
                <Select value={tamanho} onValueChange={setTamanho}>
                  <SelectTrigger id="item-tamanho">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAMANHOS_CAMISA.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-numero">Número na camisa *</Label>
                <Input
                  id="item-numero"
                  value={numeroCamisa}
                  onChange={(e) => setNumeroCamisa(e.target.value)}
                  placeholder="Ex.: 10"
                  maxLength={3}
                  inputMode="numeric"
                />
              </div>
            </div>

            <Button
              variant="gold"
              size="lg"
              className="w-full"
              disabled={cadastrando}
              onClick={cadastrar}
            >
              {cadastrando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Me cadastrar por {formatarReais(valorItem)}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              O pagamento é via PIX. O cadastro só entra na lista de pagos após a confirmação.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <PixDialog
        open={pixAberto}
        onOpenChange={(v) => {
          setPixAberto(v);
          if (!v) {
            void qc.invalidateQueries({ queryKey: ["metas"] });
            void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
            fechar();
          }
        }}
        titulo={`Pagamento — ${meta?.titulo ?? "Item"}`}
        descricao="Escaneie o QR Code ou copie o código PIX para pagar."
        dados={pix}
        carregando={!pix}
        pago={pago}
      />
    </>
  );
}
