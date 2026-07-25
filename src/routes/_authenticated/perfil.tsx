import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { perfilAtualQuery } from "@/lib/babaQueries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, HandMetal, Shield, Mail, User } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Fut Cajazeiras" },
      { name: "description", content: "Seu perfil no Fut Cajazeiras." },
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
        <h1 className="mt-3 font-display text-2xl text-foreground">{perfil?.nome}</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-gold">
          {data?.isAdmin ? "Diretoria" : "Associado"}
        </p>
      </div>

      <div className="card-premium divide-y divide-border">
        <InfoRow Icon={Mail} label="E-mail" value={perfil?.email ?? "—"} />
        <InfoRow
          Icon={perfil?.posicao === "goleiro" ? HandMetal : User}
          label="Posição"
          value={perfil?.posicao === "goleiro" ? "Goleiro" : "Jogador de linha"}
        />
        <InfoRow
          Icon={Shield}
          label="Mensalidade"
          value={emDia ? "Em dia" : "Pendente"}
          highlight={emDia ? "gold" : "destructive"}
        />
      </div>

      <Button variant="outline" size="lg" className="w-full" onClick={sair}>
        <LogOut className="size-4" /> Sair
      </Button>
    </div>
  );
}

function InfoRow({ Icon, label, value, highlight }: { Icon: typeof Mail; label: string; value: string; highlight?: "gold" | "destructive" }) {
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
