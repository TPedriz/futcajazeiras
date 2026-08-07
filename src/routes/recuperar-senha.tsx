import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { RodapeApp } from "@/components/RodapeApp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/recuperar-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar nova senha — Fut Cajazeiras" },
      {
        name: "description",
        content: "Crie uma nova senha para acessar sua conta do Fut Cajazeiras.",
      },
      { property: "og:title", content: "Criar nova senha — Fut Cajazeiras" },
      { property: "og:description", content: "Crie uma nova senha para acessar sua conta." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const navigate = useNavigate();
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const tokenHash = search.get("token_hash") ?? "";
  const tipo = (search.get("type") as "recovery" | null) ?? "recovery";

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error: verifErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tipo === "recovery" ? "recovery" : "email",
      });
      if (verifErr) throw verifErr;

      const { error: updateErr } = await supabase.auth.updateUser({ password: senha });
      if (updateErr) throw updateErr;

      setSucesso(true);
    } catch (err) {
      toast.error("Não foi possível criar a nova senha", {
        description:
          err instanceof Error && err.message
            ? err.message
            : "O link é inválido ou expirou. Solicite um novo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const irParaLogin = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!tokenHash) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-hero px-4 py-8">
        <div className="mx-auto w-full max-w-md flex-1">
          <div className="text-center">
            <BrandLogo size="lg" className="mx-auto" />
            <h1 className="mt-4 font-display text-3xl text-foreground">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link de recuperação é inválido ou está incompleto. Solicite um novo na tela de
              recuperação de senha.
            </p>
          </div>
          <div className="card-premium mt-8 p-6 text-center">
            <Link to="/esqueci-senha" className="text-sm text-gold underline">
              Solicitar novo link
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-md pt-6">
          <RodapeApp />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero px-4 py-8">
      <div className="mx-auto w-full max-w-md flex-1">
        <Link
          to="/auth"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>

        <div className="text-center">
          <BrandLogo size="lg" className="mx-auto" />
          <h1 className="mt-4 font-display text-3xl text-foreground">Criar nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fut Cajazeiras</p>
        </div>

        <div className="card-premium mt-8 p-6">
          {!sucesso ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Defina uma nova senha para voltar ao jogo.
              </p>
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                <KeyRound className="size-5" />
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto size-12 text-gold" />
              <p className="text-sm leading-relaxed text-foreground">
                Senha atualizada com sucesso! Agora é só entrar com seu WhatsApp e a nova senha para
                voltar ao jogo.
              </p>
              <Button variant="hero" size="lg" className="w-full" onClick={irParaLogin}>
                Ir para o login
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-md pt-6">
        <RodapeApp />
      </div>
    </div>
  );
}
