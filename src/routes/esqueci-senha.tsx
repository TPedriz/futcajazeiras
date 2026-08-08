import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { solicitarRecuperacaoSenha } from "@/lib/auth-admin.functions";
import { formataTelefone, telefoneValido } from "@/lib/telefone";
import { BrandLogo } from "@/components/BrandLogo";
import { RodapeApp } from "@/components/RodapeApp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MailCheck, MessageCircle } from "lucide-react";

const WHATSAPP_DIRETORIA = "https://wa.me/5571987345317";

export const Route = createFileRoute("/esqueci-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recuperar senha — Fut Cajazeiras" },
      {
        name: "description",
        content: "Recupere o acesso à sua conta do Fut Cajazeiras informando seu WhatsApp.",
      },
      { property: "og:title", content: "Recuperar senha — Fut Cajazeiras" },
      { property: "og:description", content: "Recupere o acesso à sua conta do Fut Cajazeiras." },
      { property: "og:type", content: "website" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const recuperar = useServerFn(solicitarRecuperacaoSenha);
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState<"form" | "enviado" | "sem_email">("form");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefoneValido(telefone)) {
      toast.error("Informe um número de WhatsApp válido (com DDD).");
      return;
    }
    setLoading(true);
    try {
      const res = await recuperar({ data: { telefone } });
      if (res.status === "enviado") {
        setEstado("enviado");
      } else if (res.status === "sem_email") {
        setEstado("sem_email");
      } else {
        toast.error("Cadastro não encontrado", {
          description: "Verifique o número informado e tente novamente.",
        });
      }
    } catch (err) {
      toast.error("Não foi possível enviar", {
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
      });
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="mt-4 font-display text-3xl text-foreground">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fut Cajazeiras</p>
        </div>

        <div className="card-premium mt-8 p-6">
          {estado === "form" && (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe o número de WhatsApp usado no seu cadastro para receber o link de
                recuperação.
              </p>
              <div className="space-y-2">
                <Label htmlFor="tel-recuperar">WhatsApp</Label>
                <Input
                  id="tel-recuperar"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(formataTelefone(e.target.value))}
                  className="h-12"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          )}

          {estado === "enviado" && (
            <div className="space-y-4 text-center">
              <MailCheck className="mx-auto size-12 text-gold" />
              <p className="text-sm leading-relaxed text-foreground">
                Enviamos um link de recuperação para o seu e-mail cadastrado. Acesse sua caixa de
                entrada, clique no link e crie sua nova senha para voltar ao jogo.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setEstado("form")}>
                Enviar novamente
              </Button>
              <Link to="/auth" className="block text-sm text-gold underline">
                Voltar para o login
              </Link>
            </div>
          )}

          {estado === "sem_email" && (
            <div className="space-y-4 text-center">
              <MessageCircle className="mx-auto size-12 text-gold" />
              <p className="text-sm leading-relaxed text-foreground">
                Notamos que seu cadastro é antigo e ainda não possui e-mail. Para recuperar o
                acesso, fale com a diretoria.
              </p>
              <a
                href={`${WHATSAPP_DIRETORIA}?text=${encodeURIComponent(
                  `Olá, diretoria! Preciso recuperar minha senha do Fut Cajazeiras. Meu WhatsApp é ${telefone}.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <MessageCircle className="size-5" /> Recuperar via WhatsApp
              </a>
              <Link to="/auth" className="block text-sm text-gold underline">
                Voltar para o login
              </Link>
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
