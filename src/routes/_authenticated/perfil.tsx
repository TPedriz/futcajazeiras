import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { perfilAtualQuery, presencasComoConvidadoQuery } from "@/lib/babaQueries";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, HandMetal, Shield, Phone, User, Wallet, Heart, Pencil, Save, LifeBuoy, Trophy } from "lucide-react";

import { Link } from "@tanstack/react-router";
import { tempoDeAssociado } from "@/lib/associado";
import { BrandLogo } from "@/components/BrandLogo";
import { useState } from "react";
import { formataTelefone } from "@/lib/telefone";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Fut Cajazeiras" },
      { name: "description", content: "Gerencie seu perfil no Fut Cajazeiras: WhatsApp cadastrado, posição preferida (linha ou goleiro) e status da mensalidade." },
      { property: "og:title", content: "Seu Perfil — Fut Cajazeiras" },
      { property: "og:description", content: "Atualize sua posição preferida e acompanhe sua mensalidade no Fut Cajazeiras." },
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
  const { data: presencasConvidado } = useQuery(presencasComoConvidadoQuery(data?.user.id));
  const META_CONVIDADO = 3;
  const jogados = Math.min(presencasConvidado ?? 0, META_CONVIDADO);
  const [salvando, setSalvando] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState("");

  const salvarNome = async () => {
    if (!perfil) return;
    if (nome.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("perfis").update({ nome: nome.trim() }).eq("id", perfil.id);
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

  const alterarPosicao = async (nova: "linha" | "goleiro") => {
    if (!perfil || nova === perfil.posicao) return;
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({ posicao: nova })
      .eq("id", perfil.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível atualizar a posição.");
      return;
    }
    toast.success("Posição atualizada!");
    qc.invalidateQueries({ queryKey: ["perfil-atual"] });
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
        <BrandLogo size="md" className="mx-auto" />
        {editandoNome ? (
          <div className="mt-3 space-y-2 text-left">
            <Label htmlFor="nome-perfil" className="text-xs uppercase tracking-widest text-muted-foreground">
              Nome completo
            </Label>
            <Input id="nome-perfil" value={nome} onChange={(e) => setNome(e.target.value)} className="h-12" />
            <div className="flex gap-2">
              <Button variant="gold" size="sm" className="flex-1" disabled={salvando} onClick={salvarNome}>
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

        {isConvidado && (
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-3 text-left">
            <p className="flex items-center gap-2 font-display text-lg text-gold">
              <Trophy className="size-4" /> Caminho para virar Associado
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Presenças como convidado:{" "}
              <strong className="text-foreground">
                {jogados}/{META_CONVIDADO}
              </strong>
            </p>
            <Progress value={(jogados / META_CONVIDADO) * 100} className="mt-2 h-2" />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {jogados >= META_CONVIDADO
                ? "Meta batida! Fale com a diretoria para ser promovido a Associado."
                : `Faltam ${META_CONVIDADO - jogados} baba(s) para você poder virar Associado.`}
            </p>
          </div>
        )}

        {tempo && (
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <p className="flex items-center justify-center gap-2 font-display text-lg text-gold">
              <Heart className="size-4" /> {tempo.apelido}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você faz parte do Fut Cajazeiras há <strong className="text-foreground">{tempo.texto}</strong>
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
          value={emDia ? "Em dia" : "Pendente"}
          highlight={emDia ? "gold" : "destructive"}
        />
      </div>

      <div className="card-premium p-4 space-y-3">
        <Label htmlFor="posicao-perfil" className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          {perfil?.posicao === "goleiro" ? <HandMetal className="size-4" /> : <User className="size-4" />}
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

function InfoRow({ Icon, label, value, highlight }: { Icon: typeof Phone; label: string; value: string; highlight?: "gold" | "destructive" }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="size-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold ${highlight === "gold" ? "text-gold" : highlight === "destructive" ? "text-destructive" : "text-foreground"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
