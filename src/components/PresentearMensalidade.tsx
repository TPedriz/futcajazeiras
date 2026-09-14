import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PagamentoDialog } from "@/components/PagamentoDialog";
import type { DadosCobranca, MetodoPagamento } from "@/lib/taxasPagamento";
import {
  listarMensalidadesPendentes,
  criarPixPresente,
  consultarPixPresente,
} from "@/lib/pagamentos.functions";
import { Gift } from "lucide-react";

export function PresentearMensalidade() {
  const qc = useQueryClient();
  const listar = useServerFn(listarMensalidadesPendentes);
  const gerar = useServerFn(criarPixPresente);
  const conferir = useServerFn(consultarPixPresente);

  const [escolhida, setEscolhida] = useState<string>("");
  const [aberto, setAberto] = useState(false);
  const [dadosPix, setDadosPix] = useState<DadosCobranca | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nomePresenteado, setNomePresenteado] = useState("");

  const { data: pendentes } = useQuery({
    queryKey: ["mensalidades-pendentes-presente"],
    queryFn: () => listar({ data: undefined }),
  });

  const escolhidaInfo = (pendentes ?? []).find((m) => m.mensalidadeId === escolhida);

  /** Abre o diálogo: a forma de pagamento é escolhida antes de gerar a cobrança. */
  const abrir = () => {
    if (!escolhida) {
      toast.error("Escolha quem você quer presentear");
      return;
    }
    setNomePresenteado(escolhidaInfo?.nome ?? "");
    setDadosPix(null);
    setPago(false);
    setErro(null);
    setAberto(true);
  };

  const presentear = useMutation({
    mutationFn: async (metodo: MetodoPagamento) => {
      setDadosPix(null);
      setPago(false);
      setErro(null);
      return await gerar({ data: { mensalidadeId: escolhida, metodo } });
    },
    onSuccess: (r) => {
      setNomePresenteado(r.nome);
      if (r.pago) {
        setPago(true);
        return;
      }
      setDadosPix(r);
    },
    onError: (e: Error) => {
      setErro(e.message);
      toast.error("Não foi possível gerar a cobrança", { description: e.message });
    },
  });

  useEffect(() => {
    if (!aberto || pago || !escolhida || !dadosPix) return;
    const id = setInterval(async () => {
      try {
        const r = await conferir({ data: { mensalidadeId: escolhida } });
        if (r.pago) {
          setPago(true);
          toast.success("Presente confirmado!", { description: `${nomePresenteado} está em dia.` });
          qc.invalidateQueries({ queryKey: ["mensalidades-pendentes-presente"] });
          qc.invalidateQueries({ queryKey: ["mensalidades-mes"] });
        }
      } catch {
        /* tenta de novo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [aberto, pago, escolhida, dadosPix, conferir, qc, nomePresenteado]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-start gap-3">
        <Gift className="mt-1 size-5 shrink-0 text-gold" />
        <div className="flex-1">
          <p className="font-display text-lg">Presentear alguém</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pague a mensalidade de outro jogador com PIX ou cartão. Assim que o pagamento cair, ele
            fica em dia automaticamente.
          </p>

          <div className="mt-3 space-y-2">
            <Select value={escolhida} onValueChange={setEscolhida}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Escolha quem presentear" />
              </SelectTrigger>
              <SelectContent>
                {(pendentes ?? []).map((m) => (
                  <SelectItem key={m.mensalidadeId} value={m.mensalidadeId}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="goldOutline"
              size="lg"
              className="w-full"
              disabled={!escolhida || presentear.isPending}
              onClick={abrir}
            >
              <Gift className="size-4" /> Presentear mensalidade
            </Button>
            {(pendentes ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Ninguém com mensalidade em aberto no momento.
              </p>
            )}
          </div>
        </div>
      </div>

      <PagamentoDialog
        open={aberto}
        onOpenChange={setAberto}
        titulo={nomePresenteado ? `Presente para ${nomePresenteado}` : "Presentear mensalidade"}
        descricao="Escaneie o QR Code ou copie o código no app do seu banco."
        valorBase={escolhidaInfo?.valor ?? 0}
        dados={dadosPix}
        carregando={presentear.isPending}
        pago={pago}
        erro={erro}
        onEscolherMetodo={(metodo) => presentear.mutate(metodo)}
      />
    </div>
  );
}
