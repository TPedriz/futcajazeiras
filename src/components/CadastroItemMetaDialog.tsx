import { useState } from "react";
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
import { PixMetaPagamento } from "@/components/PixMetaPagamento";
import { formatarReais, rotuloTipoArrecadacao, TAMANHOS_CAMISA } from "@/lib/redeSocial";
import { supabase } from "@/integrations/supabase/client";
import { Shirt, Loader2, CalendarClock, CheckCircle2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Meta = Database["public"]["Tables"]["metas"]["Row"];
type Etapa = "form" | "sucesso" | "pagamento";

/**
 * Cadastro de interesse em arrecadação por item (ex.: coletes personalizados).
 *
 * Fluxo em DUAS ETAPAS:
 *  1. CADASTRO (grátis): usuário preenche nome na camisa, tamanho e número.
 *     O RPC `cadastrar_interesse_item` cria a contribuição "pendente".
 *  2. PAGAMENTO: pagamento via PIX para confirmar e entrar na lista de pagos.
 *     Pode ser feito agora (Etapa 2) ou depois, pelo card da meta.
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
  const [etapa, setEtapa] = useState<Etapa>("form");
  const [contribuicaoId, setContribuicaoId] = useState<string | null>(null);

  const valorItem = Number(meta?.valor_item ?? 0);
  const prazoCadastro = meta?.prazo_cadastro ? new Date(`${meta.prazo_cadastro}T12:00:00`) : null;
  const prazoPagamento = meta?.prazo_pagamento
    ? new Date(`${meta.prazo_pagamento}T12:00:00`)
    : null;

  const fechar = () => {
    setEtapa("form");
    setContribuicaoId(null);
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
      // Etapa 1: cadastra o interesse (custo fixo definido pela diretoria) — grátis.
      const { data: idNovo, error } = await supabase.rpc("cadastrar_interesse_item", {
        p_meta_id: meta.id,
        p_nome_camisa: nomeCamisa.trim(),
        p_tamanho: tamanho,
        p_numero_camisa: numeroCamisa.trim(),
      });
      if (error) throw error;
      if (!idNovo) throw new Error("Não foi possível cadastrar.");

      setContribuicaoId(idNovo);
      setCadastrando(false);
      setEtapa("sucesso");
      void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
      void qc.invalidateQueries({ queryKey: ["minhas-contribuicoes"] });
    } catch (e) {
      setCadastrando(false);
      toast.error("Não foi possível cadastrar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    }
  };

  return (
    <>
      <Dialog open={aberto && !!meta && etapa !== "pagamento"} onOpenChange={(v) => !v && fechar()}>
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

          {etapa === "sucesso" ? (
            /* ---- Etapa 1 concluída: orienta o pagamento (Etapa 2) ---- */
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-success/15">
                <CheckCircle2 className="size-8 text-success" />
              </div>
              <p className="font-display text-lg text-foreground">Cadastro realizado!</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Etapa 1 concluída:</strong> seu interesse foi
                registrado. Para entrar na lista de{" "}
                <strong className="text-foreground">pagos</strong>, faça o pagamento de{" "}
                <strong className="text-gold">{formatarReais(valorItem)}</strong> (Etapa 2).
              </p>
              <div className="mt-1 w-full space-y-2">
                <Button
                  variant="gold"
                  size="lg"
                  className="w-full"
                  onClick={() => setEtapa("pagamento")}
                >
                  <CreditCard className="size-4" /> Pagar agora (Etapa 2)
                </Button>
                <Button variant="outline" size="lg" className="w-full" onClick={fechar}>
                  Pagar depois
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Duas etapas */}
              <div className="rounded-xl border border-gold/25 bg-gold/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Shirt className="size-3.5 text-gold" /> Como funciona — 2 etapas
                </p>
                <p className="mt-1">
                  <strong className="text-foreground">1. Cadastro:</strong> preencha seus dados —{" "}
                  grátis.
                </p>
                <p>
                  <strong className="text-foreground">2. Pagamento:</strong> pague{" "}
                  <strong className="text-gold">{formatarReais(valorItem)}</strong> para confirmar e
                  entrar na lista de pagos.
                </p>
              </div>

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
                      {prazoPagamento
                        ? format(prazoPagamento, "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
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
                Cadastrar interesse (grátis)
              </Button>

              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                O cadastro é gratuito. Para confirmar e entrar na lista de pagos, realize o
                pagamento de <strong className="text-gold">{formatarReais(valorItem)}</strong>.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Etapa 2: pagamento via PIX */}
      <PixMetaPagamento
        aberto={etapa === "pagamento" && !!meta}
        contribuicaoId={contribuicaoId}
        titulo={meta?.titulo ?? "Item"}
        onAbertoChange={(v) => {
          if (!v) fechar();
        }}
      />
    </>
  );
}
