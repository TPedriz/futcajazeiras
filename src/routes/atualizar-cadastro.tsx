import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { perfilAtualQuery } from "@/lib/babaQueries";
import { solicitarVerificacaoEmail } from "@/lib/auth-admin.functions";
import { emailSintetico } from "@/lib/email";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, MailCheck, LogOut, Pencil } from "lucide-react";

export const Route = createFileRoute("/atualizar-cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Validar cadastro — Fut Cajazeiras" },
      {
        name: "description",
        content: "Cadastre e confirme seu e-mail para acessar a plataforma do Fut Cajazeiras.",
      },
      { property: "og:title", content: "Validar cadastro — Fut Cajazeiras" },
      { property: "og:description", content: "Confirme seu e-mail para acessar a plataforma." },
      { property: "og:type", content: "website" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AtualizarCadastroPage,
});

function AtualizarCadastroPage() {
  const navigate = useNavigate();
  const solicitar = useServerFn(solicitarVerificacaoEmail);
  const { data: perfilData } = useSuspenseQuery(perfilAtualQuery());

  const emailCadastrado = perfilData?.perfil?.email
    ? emailSintetico(perfilData.perfil.email)
      ? null
      : perfilData.perfil.email
    : null;
  const jaConfirmado = !!emailCadastrado && !!perfilData?.perfil?.email_confirmado;

  const [email, setEmail] = useState(emailCadastrado ?? "");
  const [loading, setLoading] = useState(false);
  const [aguardando, setAguardando] = useState(!!emailCadastrado && !jaConfirmado);

  // Se já estiver confirmado, libera o acesso.
  useEffect(() => {
    if (jaConfirmado) navigate({ to: "/inicio" });
  }, [jaConfirmado, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      await solicitar({ data: { email: valor } });
      setAguardando(true);
    } catch (err) {
      toast.error("Não foi possível enviar a confirmação", {
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
      });
    } finally {
      setLoading(false);
    }
  };

  const sair = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero px-4 py-8">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="text-center">
          <BrandLogo size="lg" className="mx-auto" />
          <h1 className="mt-4 font-display text-3xl text-foreground">Valide seu cadastro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fut Cajazeiras</p>
        </div>

        <div className="card-premium mt-8 p-6">
          {!aguardando ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para liberar seu acesso, cadastre um e-mail válido. Não pedimos alteração de senha
                nesta etapa.
              </p>
              <div className="space-y-2">
                <Label htmlFor="email-cadastro">E-mail</Label>
                <Input
                  id="email-cadastro"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                <Mail className="size-5" />
                {loading ? "Enviando..." : "Enviar link de confirmação"}
              </Button>
              <button
                type="button"
                onClick={sair}
                className="mx-auto flex items-center gap-1 text-xs text-muted-foreground underline"
              >
                <LogOut className="size-3" /> Sair
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <MailCheck className="mx-auto size-12 text-gold" />
              <p className="text-sm leading-relaxed text-foreground">
                Quase lá! Enviamos um link de confirmação para o seu e-mail. Clique nele para
                validar seu cadastro e acessar a plataforma.
              </p>
              <p className="text-xs text-muted-foreground">E-mail: {emailCadastrado}</p>
              <Button
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  solicitar({ data: { email: emailCadastrado ?? email } })
                    .then(() =>
                      toast.success("Link reenviado!", {
                        description: "Confira sua caixa de entrada.",
                      }),
                    )
                    .catch((err: Error) =>
                      toast.error("Não foi possível reenviar", { description: err.message }),
                    )
                    .finally(() => setLoading(false));
                }}
              >
                Reenviar link
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={loading}
                onClick={() => setAguardando(false)}
              >
                <Pencil className="size-4" /> Usar outro e-mail
              </Button>
              <p className="text-xs text-muted-foreground">
                Digitou o e-mail errado ou não recebeu o link? Toque em "Usar outro e-mail" para
                corrigir e reenviar a confirmação.
              </p>
              <button
                type="button"
                onClick={sair}
                className="mx-auto flex items-center gap-1 text-xs text-muted-foreground underline"
              >
                <LogOut className="size-3" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
