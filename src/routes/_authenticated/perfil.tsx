import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  perfilAtualQuery,
  babasPagosConvidadoQuery,
  minhaSolicitacaoAssociacaoQuery,
  vagasAssociadosQuery,
  META_CONVIDADO,
  LIMITE_ASSOCIADOS,
} from "@/lib/babaQueries";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  LogOut,
  HandMetal,
  Shield,
  Phone,
  User,
  Wallet,
  Heart,
  Pencil,
  Save,
  LifeBuoy,
  Trophy,
  ShieldCheck,
  Camera,
  Check,
  Calendar,
  Instagram,
} from "lucide-react";
import { tempoDeAssociado } from "@/lib/associado";
import { normalizaInstagram, instagramFormatado, instagramUrl } from "@/lib/redeSocial";
import { AvatarJogador, avatarUrlQuery } from "@/components/AvatarJogador";
import { EditorFotoPerfil } from "@/components/EditorFotoPerfil";
import { BadgeDestaque } from "@/components/BadgeDestaque";
import { GerenciadorConquistas } from "@/components/GerenciadorConquistas";
import { EstatisticasJogador } from "@/components/EstatisticasJogador";
import { progressoNivel, xpNecessariaParaNivel } from "@/lib/gamificacao";
import { useState, useRef } from "react";
import { formataTelefone } from "@/lib/telefone";
import { PlayerCard } from "@/components/PlayerCard";
import { Download, Share2, Loader2, BadgeCheck } from "lucide-react";
import { temaEfetivo, temaBasePorOvr, type TemaCarta } from "@/lib/cartinha";
import { conquistasEmDestaqueQuery, rankingDoMesQuery, mesReferencia } from "@/lib/babaQueries";
import { rankingDeCategoria } from "@/lib/gamificacao";
import { baixarCartinha, compartilharCartinha } from "@/lib/cartinhaExport";
import type { Database } from "@/integrations/supabase/types";

type PerfilAtual = Database["public"]["Tables"]["perfis"]["Row"];

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Gerencie seu perfil no Fut Cajazeiras: WhatsApp cadastrado, posição preferida, time do coração e status da mensalidade.",
      },
      { property: "og:title", content: "Seu Perfil — Fut Cajazeiras" },
      {
        property: "og:description",
        content: "Atualize sua posição preferida e acompanhe sua mensalidade no Fut Cajazeiras.",
      },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { data } = useSuspenseQuery(perfilAtualQuery());
  const navigate = useNavigate();
  const qc = useQueryClient();

  const perfil = data?.perfil;
  const emDia = perfil?.status_pagamento === "pago";
  const tempo = tempoDeAssociado(perfil?.criado_em);
  const isConvidado = data?.isConvidado ?? false;

  const { data: babasPagos } = useQuery(babasPagosConvidadoQuery(data?.user.id));
  const { data: solicitacao } = useQuery(minhaSolicitacaoAssociacaoQuery(data?.user.id));
  const { data: vagas } = useQuery(vagasAssociadosQuery());

  const jogados = Math.min(babasPagos ?? 0, META_CONVIDADO);
  const podePedirAssociacao = jogados >= META_CONVIDADO;
  const lotado = (vagas ?? 0) >= LIMITE_ASSOCIADOS;

  const [salvando, setSalvando] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState("");
  const [editandoInstagram, setEditandoInstagram] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [origemFoto, setOrigemFoto] = useState<File | string | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);
  const { data: urlFotoAtual } = useQuery(avatarUrlQuery(perfil?.avatar_url));

  const enviarFoto = async (blob: Blob) => {
    if (!perfil) return;
    if (blob.size > 5 * 1024 * 1024) {
      toast.error("Foto muito grande", { description: "Envie uma imagem de até 5 MB." });
      return;
    }
    setEnviandoFoto(true);
    const extensao = "png";
    const caminho = `${perfil.id}/avatar-${Date.now()}.${extensao}`;
    const { error: erroUpload } = await supabase.storage
      .from("avatares")
      .upload(caminho, blob, { upsert: true, contentType: "image/png" });
    if (erroUpload) {
      setEnviandoFoto(false);
      toast.error("Não foi possível enviar a foto", { description: erroUpload.message });
      return;
    }
    const anterior = perfil.avatar_url;
    const { error } = await supabase
      .from("perfis")
      .update({ avatar_url: caminho })
      .eq("id", perfil.id);
    setEnviandoFoto(false);
    if (error) {
      toast.error("Não foi possível salvar a foto.");
      return;
    }
    if (anterior) await supabase.storage.from("avatares").remove([anterior]);
    toast.success("Foto atualizada!");
    qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
  };

  const salvarNome = async () => {
    if (!perfil) return;
    if (nome.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({ nome: nome.trim() })
      .eq("id", perfil.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar o nome.");
      return;
    }
    toast.success("Nome atualizado!");
    setEditandoNome(false);
    qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
  };

  const salvarInstagram = async () => {
    if (!perfil) return;
    const valor = normalizaInstagram(instagram);
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({ instagram: valor || null })
      .eq("id", perfil.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar o Instagram.");
      return;
    }
    toast.success(valor ? "Instagram atualizado!" : "Instagram removido.");
    setEditandoInstagram(false);
    qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
    qc.invalidateQueries({ queryKey: ["buscar-jogadores"] });
  };

  const alterarPosicao = async (nova: "linha" | "goleiro") => {
    if (!perfil || nova === perfil.posicao) return;
    setSalvando(true);
    const { error } = await supabase.from("perfis").update({ posicao: nova }).eq("id", perfil.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível atualizar a posição.");
      return;
    }
    toast.success("Posição atualizada!");
    qc.invalidateQueries({ queryKey: ["perfil-atual"] });
  };

  const definirTimeCoracao = async (time: "bahia" | "vitoria") => {
    if (!perfil || perfil.time_coracao) return;
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({ time_coracao: time })
      .eq("id", perfil.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar o time do coração.");
      return;
    }
    toast.success("Time do coração definido! Só a diretoria pode mudar daqui pra frente.");
    qc.invalidateQueries({ queryKey: ["perfil-atual"] });
    qc.invalidateQueries({ queryKey: ["perfis-publicos"] });
  };

  const pedirAssociacao = async () => {
    if (!data?.user.id) return;
    setSalvando(true);
    const { error } = await supabase
      .from("solicitacoes_associacao")
      .insert({ usuario_id: data.user.id });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível enviar o pedido", { description: error.message });
      return;
    }
    toast.success("Pedido enviado!", { description: "A diretoria vai analisar sua associação." });
    qc.invalidateQueries({ queryKey: ["solicitacao-associacao"] });
  };

  const sair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Até a próxima!");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="card-premium p-6 text-center">
        <div className="relative mx-auto w-fit">
          <AvatarJogador caminho={perfil?.avatar_url} nome={perfil?.nome} size="lg" />
          <label
            htmlFor="foto-perfil"
            className="absolute -bottom-1 -right-1 flex size-9 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-background text-gold"
            aria-label="Trocar foto do perfil"
          >
            <Camera className="size-4" />
          </label>
          <input
            id="foto-perfil"
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={enviandoFoto}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (!arquivo) return;
              if (arquivo.size > 5 * 1024 * 1024) {
                toast.error("Foto muito grande", { description: "Envie uma imagem de até 5 MB." });
                return;
              }
              setOrigemFoto(arquivo);
              setEditorAberto(true);
            }}
          />
          <EditorFotoPerfil
            origem={origemFoto}
            aberto={editorAberto}
            onAbertoChange={setEditorAberto}
            onSalvar={enviarFoto}
          />
        </div>
        {perfil?.avatar_url && (
          <button
            type="button"
            className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full border border-gold/40 bg-gold/5 px-4 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
            disabled={enviandoFoto}
            onClick={() => {
              if (!urlFotoAtual) {
                toast.error("Não foi possível carregar a foto", {
                  description: "Tente novamente em instantes.",
                });
                return;
              }
              setOrigemFoto(urlFotoAtual);
              setEditorAberto(true);
            }}
          >
            <Pencil className="size-3.5" /> Ajustar foto
          </button>
        )}
        {enviandoFoto && <p className="mt-2 text-[11px] text-muted-foreground">Enviando foto…</p>}
        {editandoNome ? (
          <div className="mt-3 space-y-2 text-left">
            <Label
              htmlFor="nome-perfil"
              className="text-xs uppercase tracking-widest text-muted-foreground"
            >
              Nome completo
            </Label>
            <Input
              id="nome-perfil"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-12"
            />
            <div className="flex gap-2">
              <Button
                variant="gold"
                size="sm"
                className="flex-1"
                disabled={salvando}
                onClick={salvarNome}
              >
                <Save className="size-4" /> Salvar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditandoNome(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 font-display text-2xl text-foreground"
            aria-label="Editar meu nome"
            onClick={() => {
              setNome(perfil?.nome ?? "");
              setEditandoNome(true);
            }}
          >
            {perfil?.nome}
            <Pencil className="size-4 text-muted-foreground" />
          </button>
        )}
        <p className="mt-1 text-xs uppercase tracking-widest text-gold">{data?.rotuloPapel}</p>
        {perfil?.ativo === false && (
          <Badge variant="destructive" className="mt-2">
            Conta desativada
          </Badge>
        )}

        {/* Nível e XP */}
        {(() => {
          const prog = progressoNivel(perfil?.xp_atual ?? 0);
          return (
            <div className="mx-auto mt-3 max-w-xs rounded-xl border border-gold/25 bg-gold/5 p-3 text-left">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg text-gold">
                  Nível {prog.nivel}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {prog.xp} XP
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {prog.xpNoNivel}/{prog.xpParaProximo} XP p/ nível {prog.nivel + 1}
                </p>
              </div>
              <Progress value={prog.progresso * 100} className="mt-1.5 h-2.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Próximo nível em {xpNecessariaParaNivel(prog.nivel + 1)} XP no total
              </p>
            </div>
          );
        })()}

        {/* Destaques do mês (gamificação) */}
        <div className="mt-2 flex justify-center">
          <BadgeDestaque usuarioId={perfil?.id} />
        </div>

        {isConvidado && (
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4 text-left">
            <p className="flex items-center gap-2 font-display text-lg text-gold">
              <Trophy className="size-4" /> Caminho para virar Associado
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Associe-se ao baba de vez! Basta{" "}
              <strong className="text-foreground">{META_CONVIDADO} babas pagos</strong> como
              convidado para liberar o pedido.
            </p>

            {/* Progresso */}
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Babas pagos</span>
              <strong className="font-display text-lg text-gold">
                {jogados}/{META_CONVIDADO}
              </strong>
            </div>
            <Progress value={(jogados / META_CONVIDADO) * 100} className="mt-1 h-2.5" />

            {/* Passos */}
            <ol className="mt-4 space-y-2">
              {[
                {
                  ok: true,
                  texto: "Participe de um baba como convidado e pague a diária.",
                },
                {
                  ok: jogados >= 1,
                  texto: `Complete ${META_CONVIDADO} babas pagos (${jogados}/${META_CONVIDADO}).`,
                },
                {
                  ok: podePedirAssociacao,
                  texto: "Envie o pedido de associação para a diretoria.",
                },
                {
                  ok: solicitacao?.status === "aprovado",
                  texto: "A diretoria aprova e você vira associado.",
                },
              ].map((passo, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      passo.ok ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {passo.ok ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className={passo.ok ? "text-foreground" : "text-muted-foreground"}>
                    {passo.texto}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Só conta baba com a diária do convidado confirmada (PIX pago). Se você já jogou babas
              antes do app existir, a diretoria pode registrar esse crédito para você.
            </p>

            {/* Ações por estado */}
            {solicitacao?.status === "pendente" ? (
              <div className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-center">
                <p className="flex items-center justify-center gap-2 font-semibold text-gold">
                  <ShieldCheck className="size-4" /> Pedido de associação em análise
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A diretoria foi avisada e vai analisar. Você será notificado pelo sino.
                </p>
              </div>
            ) : podePedirAssociacao ? (
              <>
                <Button
                  variant="gold"
                  size="lg"
                  className="mt-3 w-full"
                  disabled={salvando || lotado}
                  onClick={pedirAssociacao}
                >
                  <ShieldCheck className="size-4" /> Solicitar associação ao baba
                </Button>
                {lotado && (
                  <p className="mt-2 text-[11px] text-destructive">
                    O baba está com as {LIMITE_ASSOCIADOS} vagas preenchidas. Aguarde abrir vaga.
                  </p>
                )}
              </>
            ) : (
              <Link to="/baba">
                <Button variant="goldOutline" size="lg" className="mt-3 w-full">
                  <Calendar className="size-4" /> Ir para o próximo baba
                  <span className="text-[11px] text-muted-foreground">
                    ({META_CONVIDADO - jogados} {META_CONVIDADO - jogados === 1 ? "baba" : "babas"}{" "}
                    para completar)
                  </span>
                </Button>
              </Link>
            )}
          </div>
        )}

        {tempo && (
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <p className="flex items-center justify-center gap-2 font-display text-lg text-gold">
              <Heart className="size-4" /> {tempo.apelido}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você faz parte do Fut Cajazeiras há{" "}
              <strong className="text-foreground">{tempo.texto}</strong>
            </p>
            <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
              desde {tempo.desdeFormatado} • {tempo.dias} dias de camisa
            </p>
          </div>
        )}
      </div>

      <div className="card-premium divide-y divide-border">
        <InfoRow
          Icon={Phone}
          label="WhatsApp"
          value={perfil?.telefone ? formataTelefone(perfil.telefone) : "—"}
        />
        <InfoRow
          Icon={Shield}
          label="Mensalidade"
          value={isConvidado ? "Isento (convidado)" : emDia ? "Em dia" : "Pendente"}
          highlight={isConvidado ? undefined : emDia ? "gold" : "destructive"}
        />
      </div>

      {/* Instagram (rede social) */}
      <div className="card-premium space-y-3 p-4">
        <Label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Instagram className="size-4" /> Instagram
        </Label>

        {editandoInstagram ? (
          <div className="space-y-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="instagram-perfil"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="seu.usuario"
                className="h-12 pl-7"
                maxLength={40}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="gold"
                size="sm"
                className="flex-1"
                disabled={salvando}
                onClick={salvarInstagram}
              >
                <Save className="size-4" /> Salvar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditandoInstagram(false)}>
                Cancelar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pode deixar em branco para remover. O @ aparece no seu perfil público, cartinha e
              rankings.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {instagramFormatado(perfil?.instagram) ? (
              <a
                href={instagramUrl(perfil?.instagram) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-400 hover:underline"
              >
                <Instagram className="size-4" />
                {instagramFormatado(perfil?.instagram)}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Não informado.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInstagram(perfil?.instagram ?? "");
                setEditandoInstagram(true);
              }}
            >
              <Pencil className="size-3.5" /> Editar
            </Button>
          </div>
        )}
      </div>

      {/* Time do coração — BAxVI */}
      <div className="card-premium space-y-3 p-4">
        <Label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Heart className="size-4" /> Time do coração (BAxVI)
        </Label>{" "}
        {perfil?.time_coracao ? (
          <p className="font-display text-2xl text-gold">
            {perfil.time_coracao === "bahia" ? "Bahia" : "Vitória"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={salvando}
              onClick={() => definirTimeCoracao("bahia")}
            >
              Bahia
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={salvando}
              onClick={() => definirTimeCoracao("vitoria")}
            >
              Vitória
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          A escolha é definitiva: depois de marcada, só a diretoria pode alterar.
        </p>
      </div>

      {/* Minha Cartinha (estilo FUT) */}
      <MinhaCartinha perfil={perfil} usuarioId={perfil?.id} />

      {/* Estatísticas individuais + janela de cartões amarelos */}
      <EstatisticasJogador usuarioId={perfil?.id} />

      {/* Minhas Conquistas (gamificação) */}
      <div className="card-premium space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Trophy className="size-4 text-gold" /> Conquistas
          </Label>
          <Link to="/conquistas" className="text-[11px] font-semibold text-gold hover:underline">
            Ver tudo →
          </Link>
        </div>
        <GerenciadorConquistas usuarioId={perfil?.id} />
      </div>

      <div className="card-premium space-y-3 p-4">
        <Label
          htmlFor="posicao-perfil"
          className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"
        >
          {perfil?.posicao === "goleiro" ? (
            <HandMetal className="size-4" />
          ) : (
            <User className="size-4" />
          )}
          Posição preferida
        </Label>
        <Select
          value={perfil?.posicao ?? "linha"}
          onValueChange={(v) => alterarPosicao(v as "linha" | "goleiro")}
          disabled={salvando}
        >
          <SelectTrigger id="posicao-perfil" className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linha">Jogador de linha</SelectItem>
            <SelectItem value="goleiro">Goleiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Link to="/pagamentos">
        <Button variant="goldOutline" size="lg" className="w-full">
          <Wallet className="size-4" /> Histórico de pagamentos
        </Button>
      </Link>

      <Link to="/ajuda">
        <Button variant="outline" size="lg" className="w-full">
          <LifeBuoy className="size-4" /> Ajuda e regras
        </Button>
      </Link>

      <Button variant="outline" size="lg" className="w-full" onClick={sair}>
        <LogOut className="size-4" /> Sair
      </Button>
    </div>
  );
}

function InfoRow({
  Icon,
  label,
  value,
  highlight,
}: {
  Icon: typeof Phone;
  label: string;
  value: string;
  highlight?: "gold" | "destructive";
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="size-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p
          className={`text-sm font-semibold ${highlight === "gold" ? "text-gold" : highlight === "destructive" ? "text-destructive" : "text-foreground"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/** Seção "Minha Cartinha" no perfil: exibe a cartinha oficial + exportar. */
function MinhaCartinha({
  perfil,
  usuarioId,
}: {
  perfil: PerfilAtual | null | undefined;
  usuarioId: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: destaquesMap } = useQuery(conquistasEmDestaqueQuery());
  const referencia = mesReferencia();
  const { data: ranking } = useQuery(rankingDoMesQuery(referencia));
  const [exportando, setExportando] = useState(false);

  if (!usuarioId || !perfil?.id) return null;

  const posicao = perfil.posicao;
  const nivel = perfil.nivel_atual ?? 1;
  const top1Mes = (() => {
    if (!ranking) return false;
    const categorias = ["gols", "assistencias", "penaltis"] as const;
    return categorias.some((cat) => {
      const r = rankingDeCategoria(ranking, cat);
      return r[0]?.usuario_id === usuarioId;
    });
  })();

  const base = temaBasePorOvr(perfil.ovr ?? 40) as TemaCarta;
  const tema = temaEfetivo(base, {
    top1Mes,
    nivel,
    goleiroDestaque: posicao === "goleiro" && (perfil.stat_fisico ?? 0) >= 70,
  });

  const conquistas = (destaquesMap?.get(usuarioId) ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    icone: c.icone,
  }));

  const aoExportar = async (tipo: "baixar" | "compartilhar") => {
    if (!ref.current) return;
    setExportando(true);
    try {
      const ok =
        tipo === "baixar"
          ? await baixarCartinha(ref.current, "minha-cartinha.png")
          : await compartilharCartinha(ref.current);
      if (!ok) toast.error("Não foi possível exportar a cartinha");
    } catch {
      toast.error("Não foi possível exportar a cartinha");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="card-premium space-y-3 p-4">
      <Label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <BadgeCheck className="size-4 text-gold" /> Minha Cartinha
      </Label>
      <div className="flex justify-center">
        <PlayerCard
          ref={ref}
          nome={perfil.nome}
          fotoUrl={perfil.avatar_url}
          posicao={perfil.posicao}
          ovr={perfil.ovr ?? 40}
          pac={perfil.stat_ritmo ?? 40}
          sho={perfil.stat_finalizacao ?? 40}
          pas={perfil.stat_passe ?? 40}
          dri={perfil.stat_drible ?? 40}
          def={perfil.stat_defesa ?? 40}
          phy={perfil.stat_fisico ?? 40}
          nivel={nivel}
          tema={tema}
          conquistas={conquistas}
          instagram={perfil.instagram}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="gold" disabled={exportando} onClick={() => aoExportar("baixar")}>
          {exportando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Baixar
        </Button>
        <Button
          variant="goldOutline"
          disabled={exportando}
          onClick={() => aoExportar("compartilhar")}
        >
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Seus atributos são calculados automaticamente a partir das presenças, gols, assistências,
        vitórias e nível de XP. O tema muda conforme o OVR.
      </p>
    </div>
  );
}
