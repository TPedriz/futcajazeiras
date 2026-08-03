import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Navigation, X, Users } from "lucide-react";
import { AvatarJogador } from "@/components/AvatarJogador";

export interface PresencaChegada {
  id: string;
  usuario_id: string;
  convidado_user_id?: string | null;
  nome_convidado?: string | null;
  status_convidado?: string | null;
  chegou_em?: string | null;
  ordem_chegada?: number | null;
  perfis?: { nome: string; avatar_url?: string | null } | null;
}

interface Props {
  sessao: { id: string; data_horario: string; mostrar_lista_chegada: boolean };
  presencas: PresencaChegada[];
  minhaPresencaId?: string;
  jaChegou?: boolean;
  isAdmin: boolean;
}

/** Janela do check-in presencial: abre 30 min antes e encerra 1 hora após o início do baba. */
export function janelaChegada(dataHorario: string) {
  const jogo = new Date(dataHorario);
  const abertura = new Date(jogo.getTime() - 30 * 60 * 1000);
  const limite = new Date(jogo.getTime() + 60 * 60 * 1000);
  return { abertura, limite };
}

export function ChegadaGps({ sessao, presencas, minhaPresencaId, jaChegou, isAdmin }: Props) {
  const qc = useQueryClient();
  const [agora, setAgora] = useState(() => Date.now());
  const [erroGps, setErroGps] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const { abertura, limite } = useMemo(() => janelaChegada(sessao.data_horario), [sessao.data_horario]);
  const aberto = agora >= abertura.getTime() && agora <= limite.getTime();

  const chegados = useMemo(
    () =>
      presencas
        .filter((p) => p.ordem_chegada != null)
        .sort((a, b) => (a.ordem_chegada ?? 0) - (b.ordem_chegada ?? 0)),
    [presencas],
  );

  const invalidar = () => qc.invalidateQueries({ queryKey: ["presencas", sessao.id] });

  const marcar = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      if (!minhaPresencaId) throw new Error("Confirme sua presença na lista antes de marcar a chegada.");

      const { data, error } = await supabase.rpc("marcar_chegada", {
        _presenca_id: minhaPresencaId,
        _lat: lat,
        _lng: lng,
      });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    onSuccess: (ordem) => {
      toast.success("Chegada confirmada!", { description: `Você é o ${ordem}º da fila.` });
      invalidar();
    },
    onError: (e: Error) => toast.error("Não deu para marcar", { description: e.message }),
  });

  /**
   * GPS robusto no iOS: getCurrentPosition é chamado de forma SINCRONA no
   * gesto de toque (exigência do iOS Safari para exibir o prompt de permissão),
   * com fallback para baixa precisão em caso de timeout e erros traduzidos.
   */
  const obterPosicao = () => {
    if (!("geolocation" in navigator)) {
      setErroGps("Seu navegador não suporta localização. Use Safari ou Chrome atualizados.");
      return;
    }
    setErroGps(null);

    const tentar = (altaPrecisao: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setErroGps(null);
          marcar.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          // Timeout com alta precisão (GPS lento no iOS): tenta com localização por rede.
          if (altaPrecisao && err.code === err.TIMEOUT) {
            tentar(false);
            return;
          }
          if (err.code === err.PERMISSION_DENIED) {
            setErroGps(
              "Permissão de localização negada. No iPhone: Ajustes > Safari > Localização > “Ao usar o app”. Depois tente de novo.",
            );
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setErroGps("Não conseguimos pegar sua localização. Tente de novo, de preferência ao ar livre.");
          } else {
            setErroGps("A localização demorou demais. Toque em “Cheguei à Arena” para tentar de novo.");
          }
        },
        { enableHighAccuracy: altaPrecisao, timeout: altaPrecisao ? 10000 : 15000, maximumAge: 0 },
      );
    };

    tentar(true);
  };

  const anular = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("presencas")
        .update({ chegou_em: null, ordem_chegada: null, compareceu: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chegada anulada");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      <div className="card-premium p-5">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 size-5 shrink-0 text-gold" />
          <div className="flex-1">
            <p className="font-display text-lg">Cheguei à Arena</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Abre às {hora(abertura)} e encerra às {hora(limite)}. Você precisa estar a menos de 1 km da arena —
              validamos pelo GPS do celular.
            </p>

            {jaChegou ? (
              <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
                Chegada confirmada. Fique de olho na formação dos times.
              </div>
            ) : (
              <>
                <Button
                  variant="hero"
                  size="lg"
                  className="mt-3 w-full"
                  disabled={!aberto || marcar.isPending || !minhaPresencaId}
                  onClick={obterPosicao}
                >
                  <Navigation className="size-4" />
                  {marcar.isPending ? "Validando localização…" : aberto ? "Cheguei à Arena" : `Abre às ${hora(abertura)}`}
                </Button>
                {erroGps && (
                  <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                    {erroGps}
                  </p>
                )}
              </>
            )}
            {!minhaPresencaId && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Confirme sua presença na lista para liberar a marcação de chegada.
              </p>
            )}
          </div>
        </div>
      </div>

      {(sessao.mostrar_lista_chegada || isAdmin) && (
        <div className="card-premium p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-gold" />
              <p className="font-display text-lg">Presentes até o momento</p>
            </div>
            <Badge variant="outline" className="border-gold/40 text-gold">
              {chegados.length}
            </Badge>
          </div>
          {!sessao.mostrar_lista_chegada && (
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Visível só para a diretoria
            </p>
          )}
          {chegados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém marcou chegada ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {chegados.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface p-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/10 font-display text-xs text-gold">
                    {p.ordem_chegada}
                  </span>
                  <AvatarJogador caminho={p.perfis?.avatar_url} nome={p.nome_convidado ?? p.perfis?.nome} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.nome_convidado ?? p.perfis?.nome ?? "Jogador"}
                    {p.nome_convidado && <span className="ml-1 text-[10px] text-muted-foreground">(convidado)</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.chegou_em ? new Date(p.chegou_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label="Anular chegada"
                      onClick={() => anular.mutate(p.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
