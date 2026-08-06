import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PixDialog, type DadosPix } from "@/components/PixDialog";
import { listarMensalidadesPendentes, criarPixPresente, consultarPixPresente } from "@/lib/pagamentos.functions";
import { Gift } from "lucide-react";

export function PresentearMensalidade() {
  const qc = useQueryClient();
  const listar = useServerFn(listarMensalidadesPendentes);
  const gerar = useServerFn(criarPixPresente);
  const conferir = useServerFn(consultarPixPresente);

  const [escolhida, setEscolhida] = useState<string>("");
  const [aberto, setAberto] = useState(false);
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
  const [pago, setPago] = useState(false);
  const [nomePresenteado, setNomePresenteado] = useState("");

  const { data: pendentes } = useQuery({
    queryKey: ["mensalidades-pendentes-presente"],
    queryFn: () => listar({ data: undefined }),
  });

  const presentear = useMutation({
    mutationFn: async () => {
      if (!escolhida) throw new Error("Escolha quem você quer presentear");
      setDadosPix(null);
      setPago(false);
      setAberto(true);
      return await gerar({ data: { mensalidadeId: escolhida } });
    },
    onSuccess: (r) => {
      setNomePresenteado(r.nome);
      if (r.pago) {
        setPago(true);
        return;
      }
      setDadosPix({ qrCode: r.qrCode, qrBase64: r.qrBase64, valor: r.valor });
    },
    onError: (e: Error) => {
      setAberto(false);
      toast.error("Não foi possível gerar o PIX", { description: e.message });
    },
  });

  useEffect(() => {
    if (!aberto || pago || !escolhida) return;
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
  }, [aberto, pago, escolhida, conferir, qc, nomePresenteado]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-start gap-3">
        <Gift className="mt-1 size-5 shrink-0 text-gold" />
        <div className="flex-1">
          <p className="font-display text-lg">Presentear alguém</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pague a mensalidade de outro jogador. Assim que o PIX cair, ele fica em dia automaticamente.
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
              onClick={() => presentear.mutate()}
            >
              <Gift className="size-4" /> Gerar PIX do presente
            </Button>
            {(pendentes ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Ninguém com mensalidade em aberto no momento.</p>
            )}
          </div>
        </div>
      </div>

      <PixDialog
        open={aberto}
        onOpenChange={setAberto}
        titulo={nomePresenteado ? `Presente para ${nomePresenteado}` : "Presentear mensalidade"}
        descricao="Escaneie o QR Code ou copie o código no app do seu banco."
        dados={dadosPix}
        carregando={presentear.isPending}
        pago={pago}
      />
    </div>
  );
}
