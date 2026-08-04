import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PixDialog, type DadosPix } from "@/components/PixDialog";
import { listarAnfitrioes, solicitarConvite, pixDaSolicitacao } from "@/lib/convidados.functions";
import { minhasSolicitacoesQuery, valorConvidadoQuery } from "@/lib/babaQueries";
import { HandHeart, QrCode, MessageCircle } from "lucide-react";

const GRUPO_WHATSAPP_URL = "https://chat.whatsapp.com/HtGUdc005Hd9NLqY8Bcg3W";

export function ConviteConvidado({ babaId, userId }: { babaId: string; userId: string }) {
  const qc = useQueryClient();
  const buscarAnfitrioes = useServerFn(listarAnfitrioes);
  const pedir = useServerFn(solicitarConvite);
  const verPix = useServerFn(pixDaSolicitacao);
  const { data: valorConvidado } = useQuery(valorConvidadoQuery());

  const [anfitriao, setAnfitriao] = useState<string>("");
  const [pixAberto, setPixAberto] = useState(false);
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
  const [pago, setPago] = useState(false);
  const [carregandoPix, setCarregandoPix] = useState(false);
  const [aguardandoDiretoria, setAguardandoDiretoria] = useState(false);
  const [semCobranca, setSemCobranca] = useState(false);

  const { data: anfitrioes } = useQuery({
    queryKey: ["anfitrioes"],
    queryFn: () => buscarAnfitrioes({ data: undefined }),
  });
  const { data: solicitacoes } = useQuery(minhasSolicitacoesQuery(userId, babaId));
  const ativa = (solicitacoes ?? []).find((s) => s.status !== "rejeitado");

  const enviar = useMutation({
    mutationFn: async () => {
      if (!anfitriao) throw new Error("Escolha um associado");
      return await pedir({ data: { babaId, anfitriaoId: anfitriao } });
    },
    onSuccess: () => {
      toast.success("Solicitação enviada!", { description: "Aguarde o associado aceitar." });
      qc.invalidateQueries({ queryKey: ["solicitacoes-minhas"] });
    },
    onError: (e: Error) => toast.error("Não deu certo", { description: e.message }),
  });

  const abrirPix = async () => {
    if (!ativa) return;
    setPixAberto(true);
    setPago(false);
    setDadosPix(null);
    setAguardandoDiretoria(false);
    setSemCobranca(false);
    setCarregandoPix(true);
    try {
      const r = await verPix({ data: { solicitacaoId: ativa.id } });
      if (r.pago) {
        setPago(true);
      } else if (r.status === "aguardando_diretoria") {
        setAguardandoDiretoria(true);
        setPixAberto(false);
      } else if (r.status === "sem_cobranca") {
        setSemCobranca(true);
        setPixAberto(false);
      } else {
        setDadosPix({ qrCode: r.qrCode, qrBase64: r.qrBase64, valor: r.valor });
      }
    } catch (e) {
      setPixAberto(false);
      toast.error("Erro", { description: (e as Error).message });
    } finally {
      setCarregandoPix(false);
    }
  };

  useEffect(() => {
    if (!ativa || ativa.status !== "aprovado" || pago) return;
    const id = setInterval(async () => {
      try {
        const r = await verPix({ data: { solicitacaoId: ativa.id } });
        if (r.pago) {
          setPago(true);
          setAguardandoDiretoria(false);
          setSemCobranca(false);
          qc.invalidateQueries({ queryKey: ["presencas", babaId] });
          toast.success("Pagamento confirmado! Você está na lista.");
        } else if (r.status === "aguardando_diretoria") {
          setAguardandoDiretoria(true);
          setSemCobranca(false);
          setPixAberto(false);
        } else if (r.status === "sem_cobranca") {
          setSemCobranca(true);
          setAguardandoDiretoria(false);
          setPixAberto(false);
        } else if (r.qrCode) {
          setDadosPix({ qrCode: r.qrCode, qrBase64: r.qrBase64, valor: r.valor });
          setAguardandoDiretoria(false);
          setSemCobranca(false);
        }
      } catch {
        /* tenta de novo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [ativa, pago, verPix, qc, babaId]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-start gap-3">
        <HandHeart className="mt-1 size-5 shrink-0 text-gold" />
        <div className="flex-1">
          <p className="font-display text-lg">Ir como convidado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Convidados não entram direto na lista: peça a um associado para te levar. Se ele
            aceitar, você paga a taxa de{" "}
            <strong className="text-gold">
              R$ {Number(valorConvidado ?? 5).toFixed(2).replace(".", ",")}
            </strong>{" "}
            via PIX e entra na lista.
          </p>

          {ativa ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {ativa.status === "pendente"
                    ? "Aguardando resposta do associado"
                    : aguardandoDiretoria
                      ? "Aguardando aprovação da diretoria"
                      : semCobranca
                        ? "Aguardando o PIX ser gerado"
                        : "Convite aceito"}
                </p>
                {ativa.status === "pendente" ? (
                  <Badge variant="outline" className="border-gold/40 text-gold">
                    Pendente
                  </Badge>
                ) : aguardandoDiretoria ? (
                  <Badge variant="outline" className="border-gold/40 text-gold">
                    Diretoria
                  </Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground">Aceito</Badge>
                )}
              </div>
              {aguardandoDiretoria && (
                <p className="text-xs text-muted-foreground">
                  O associado aceitou, mas a diretoria ainda precisa aprovar. Você será avisado.
                </p>
              )}
              {semCobranca && (
                <p className="text-xs text-muted-foreground">
                  Aprovado! O associado ainda não gerou o PIX. Quando ele gerar, ele aparece aqui.
                </p>
              )}
              {pago ? (
                <div className="space-y-3">
                  <p className="text-sm text-success">Pagamento confirmado! Você está na lista.</p>
                  <a
                    href={GRUPO_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="goldOutline" size="lg" className="w-full">
                      <MessageCircle className="size-4" /> Entrar no grupo do WhatsApp
                    </Button>
                  </a>
                </div>
              ) : ativa.status === "aprovado" && !aguardandoDiretoria && !semCobranca ? (
                <Button variant="hero" size="lg" className="w-full" onClick={abrirPix}>
                  <QrCode className="size-4" /> Pagar taxa com PIX
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Select value={anfitriao} onValueChange={setAnfitriao}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Escolha o associado" />
                </SelectTrigger>
                <SelectContent>
                  {(anfitrioes ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="goldOutline"
                size="lg"
                className="w-full"
                disabled={enviar.isPending || !anfitriao}
                onClick={() => enviar.mutate()}
              >
                Solicitar convite
              </Button>
            </div>
          )}
        </div>
      </div>

      <PixDialog
        open={pixAberto}
        onOpenChange={setPixAberto}
        titulo="Taxa do convidado"
        descricao="Escaneie o QR Code ou copie o código no app do seu banco. A confirmação é automática."
        dados={dadosPix}
        carregando={carregandoPix}
        pago={pago}
      />
    </div>
  );
}
