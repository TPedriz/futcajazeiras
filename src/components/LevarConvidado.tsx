import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PixDialog, type DadosPix } from "@/components/PixDialog";
import { convidadosDaCasaQuery, meusPedidosConvidadoQuery } from "@/lib/babaQueries";
import { criarPedidoConvidado, gerarPixPedido } from "@/lib/convidados.functions";
import { formataTelefone } from "@/lib/telefone";
import { UserPlus, Sparkles, Home, QrCode, Clock } from "lucide-react";

type Modo = "escolha" | "novo" | "casa";

export function LevarConvidado({ babaId, userId }: { babaId: string; userId: string }) {
  const qc = useQueryClient();
  const pedir = useServerFn(criarPedidoConvidado);
  const gerarPix = useServerFn(gerarPixPedido);

  const [modo, setModo] = useState<Modo>("escolha");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [daCasa, setDaCasa] = useState("");
  const [pixAberto, setPixAberto] = useState(false);
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
  const [pago, setPago] = useState(false);
  const [carregandoPix, setCarregandoPix] = useState(false);

  const { data: convidadosCasa } = useQuery(convidadosDaCasaQuery());
  const { data: pedidos } = useQuery(meusPedidosConvidadoQuery(userId, babaId));
  const pedidoAtivo = (pedidos ?? []).find((p) => p.status !== "rejeitado");

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["pedidos-convidado-meus"] });
    qc.invalidateQueries({ queryKey: ["presencas", babaId] });
  };

  const enviar = useMutation({
    mutationFn: async () => {
      if (modo === "casa") {
        if (!daCasa) throw new Error("Escolha o convidado");
        return await pedir({ data: { babaId, convidadoId: daCasa } });
      }
      return await pedir({ data: { babaId, nome, telefone } });
    },
    onSuccess: (r) => {
      setModo("escolha");
      setNome("");
      setTelefone("");
      setDaCasa("");
      invalidar();
      if (r.status === "aprovado") {
        toast.success("Convidado liberado!", { description: "Gere o PIX da diária para confirmar a vaga." });
      } else {
        toast.success("Solicitação enviada!", { description: "A diretoria vai analisar o convidado." });
      }
    },
    onError: (e: Error) => toast.error("Não deu certo", { description: e.message }),
  });

  const abrirPix = async () => {
    if (!pedidoAtivo) return;
    setPixAberto(true);
    setPago(false);
    setDadosPix(null);
    setCarregandoPix(true);
    try {
      const r = await gerarPix({ data: { pedidoId: pedidoAtivo.id } });
      if (r.pago) setPago(true);
      else setDadosPix({ qrCode: r.qrCode, qrBase64: r.qrBase64, valor: r.valor });
      invalidar();
    } catch (e) {
      setPixAberto(false);
      toast.error("Erro", { description: (e as Error).message });
    } finally {
      setCarregandoPix(false);
    }
  };

  const nomeConvidado = pedidoAtivo?.convidados_cadastro?.nome ?? "Convidado";

  return (
    <div className="card-premium p-5">
      <div className="flex items-start gap-3">
        <UserPlus className="mt-1 size-5 shrink-0 text-gold" />
        <div className="flex-1">
          <p className="font-display text-lg">Levar convidado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Você pode levar 1 convidado por baba. Convidado novo passa pela aprovação da diretoria;
            convidado da casa já libera o PIX de <strong className="text-gold">R$ 5,00</strong> na hora.
          </p>

          {pedidoAtivo ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold">{nomeConvidado}</p>
                {pedidoAtivo.status === "pendente" ? (
                  <Badge variant="outline" className="border-gold/40 text-gold">
                    <Clock className="mr-1 size-3" /> Pendente de aprovação
                  </Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground">Aprovado</Badge>
                )}
              </div>
              {pedidoAtivo.status === "pendente" ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma cobrança é gerada antes da diretoria aprovar. Você será avisado pelo sininho.
                </p>
              ) : (
                <Button variant="hero" size="lg" className="w-full" onClick={abrirPix}>
                  <QrCode className="size-4" /> Gerar PIX
                </Button>
              )}
            </div>
          ) : modo === "escolha" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="goldOutline" size="lg" onClick={() => setModo("novo")}>
                <Sparkles className="size-4" /> Convidado novo
              </Button>
              <Button variant="goldOutline" size="lg" onClick={() => setModo("casa")}>
                <Home className="size-4" /> Convidado da casa
              </Button>
            </div>
          ) : modo === "novo" ? (
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="conv-nome">Nome completo</Label>
                <Input
                  id="conv-nome"
                  className="h-12"
                  placeholder="Nome do convidado"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="conv-tel">WhatsApp</Label>
                <Input
                  id="conv-tel"
                  className="h-12"
                  inputMode="tel"
                  placeholder="(71) 90000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(formataTelefone(e.target.value))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                O histórico de babas pagos fica no WhatsApp dele. Quando criar conta com esse número,
                tudo é vinculado ao perfil automaticamente.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="lg" className="flex-1" onClick={() => setModo("escolha")}>
                  Voltar
                </Button>
                <Button
                  variant="hero"
                  size="lg"
                  className="flex-1"
                  disabled={enviar.isPending}
                  onClick={() => enviar.mutate()}
                >
                  Solicitar convidado
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <Select value={daCasa} onValueChange={setDaCasa}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Escolha o convidado da casa" />
                </SelectTrigger>
                <SelectContent>
                  {(convidadosCasa ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(convidadosCasa ?? []).length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Ainda não há convidados aprovados pela diretoria. Cadastre como convidado novo.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="lg" className="flex-1" onClick={() => setModo("escolha")}>
                  Voltar
                </Button>
                <Button
                  variant="hero"
                  size="lg"
                  className="flex-1"
                  disabled={enviar.isPending || !daCasa}
                  onClick={() => enviar.mutate()}
                >
                  Liberar PIX
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PixDialog
        open={pixAberto}
        onOpenChange={setPixAberto}
        titulo="Diária do convidado"
        descricao="Escaneie o QR Code ou copie o código no app do seu banco. A confirmação é automática."
        dados={dadosPix}
        carregando={carregandoPix}
        pago={pago}
      />
    </div>
  );
}
