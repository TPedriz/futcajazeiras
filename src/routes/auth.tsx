import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { RodapeApp } from "@/components/RodapeApp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  formataTelefone,
  normalizaTelefone,
  telefoneParaEmail,
  telefoneValido,
} from "@/lib/telefone";

const searchSchema = z.object({
  modo: z.enum(["login", "cadastro"]).optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Fut Cajazeiras" },
      { name: "description", content: "Acesse sua conta de associado do Fut Cajazeiras ou solicite entrada." },
      { property: "og:title", content: "Entrar — Fut Cajazeiras" },
      { property: "og:description", content: "Área do associado do Fut Cajazeiras." },
    ],
  }),
  validateSearch: searchSchema,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Login state
  const [telefoneLogin, setTelefoneLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");

  // Cadastro state
  const [nome, setNome] = useState("");
  const [telefoneCadastro, setTelefoneCadastro] = useState("");
  const [senhaCadastro, setSenhaCadastro] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefoneValido(telefoneLogin)) {
      toast.error("Informe um número de WhatsApp válido (com DDD).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: telefoneParaEmail(telefoneLogin),
      password: senhaLogin,
    });
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: "Verifique o número e a senha." });
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/inicio" });
  };

  const onCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!telefoneValido(telefoneCadastro)) {
      toast.error("Informe um número de WhatsApp válido (com DDD).");
      return;
    }
    if (senhaCadastro.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const telefone = normalizaTelefone(telefoneCadastro);
    const { error } = await supabase.auth.signUp({
      email: telefoneParaEmail(telefoneCadastro),
      password: senhaCadastro,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        data: { nome: nome.trim(), telefone, posicao },
      },
    });
    setLoading(false);
    if (error) {
      const msg = /already/i.test(error.message)
        ? "Este número já está cadastrado."
        : error.message;
      toast.error("Não foi possível cadastrar", { description: msg });
      return;
    }
    // Auto-confirm está ligado: já faz login direto
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: telefoneParaEmail(telefoneCadastro),
      password: senhaCadastro,
    });
    if (loginErr) {
      toast.success("Conta criada!", { description: "Faça login para continuar." });
      return;
    }
    toast.success("Conta criada!", { description: "Bem-vindo ao Fut Cajazeiras." });
    navigate({ to: "/inicio" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero px-4 py-8">
      <div className="mx-auto w-full max-w-md flex-1">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </Link>

        <div className="text-center">
          <BrandLogo size="lg" className="mx-auto" />
          <h1 className="mt-4 font-display text-3xl text-foreground">Área do Associado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fut Cajazeiras</p>
        </div>

        <div className="card-premium mt-8 p-6">
          <Tabs defaultValue={modo === "cadastro" ? "cadastro" : "login"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="cadastro">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tel-login">WhatsApp</Label>
                  <Input
                    id="tel-login"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    required
                    value={telefoneLogin}
                    onChange={(e) => setTelefoneLogin(formataTelefone(e.target.value))}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-login">Senha</Label>
                  <Input
                    id="senha-login"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={senhaLogin}
                    onChange={(e) => setSenhaLogin(e.target.value)}
                    className="h-12"
                  />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="cadastro">
              <form onSubmit={onCadastro} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tel-cad">WhatsApp</Label>
                  <Input
                    id="tel-cad"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    required
                    value={telefoneCadastro}
                    onChange={(e) => setTelefoneCadastro(formataTelefone(e.target.value))}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">Use o número com DDD. Ele será seu login.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-cad">Senha</Label>
                  <Input
                    id="senha-cad"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={senhaCadastro}
                    onChange={(e) => setSenhaCadastro(e.target.value)}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="posicao">Posição preferida</Label>
                  <Select value={posicao} onValueChange={(v) => setPosicao(v as "linha" | "goleiro")}>
                    <SelectTrigger id="posicao" className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linha">Jogador de linha</SelectItem>
                      <SelectItem value="goleiro">Goleiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Você pode alterar no seu perfil quando quiser.</p>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Cadastrando..." : "Solicitar entrada"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md pt-6">
        <RodapeApp />
      </div>
    </div>
  );
}
