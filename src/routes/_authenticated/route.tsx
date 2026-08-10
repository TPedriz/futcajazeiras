import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { emailReal } from "@/lib/email";
import { BottomNav } from "@/components/BottomNav";
import { perfilAtualQuery } from "@/lib/babaQueries";
import { BrandLogo } from "@/components/BrandLogo";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";
import { AvatarJogador } from "@/components/AvatarJogador";
import { RodapeApp } from "@/components/RodapeApp";
import { CartinhaProvider } from "@/components/CartinhaModal";
import { BubbleConquista } from "@/components/BubbleConquista";
import { NotificacoesProvider } from "@/components/NotificacoesProvider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Guard de bloqueio: após o login, exige e-mail real confirmado.
    // Sem e-mail (cadastro antigo) ou e-mail não confirmado => /atualizar-cadastro.
    const { data: perfil } = await supabase
      .from("perfis")
      .select("email, email_confirmado")
      .eq("id", data.user.id)
      .maybeSingle();
    const contato = perfil?.email ? emailReal(perfil.email) : null;
    if (!contato || !perfil?.email_confirmado) {
      throw redirect({ to: "/atualizar-cadastro" });
    }

    return { user: data.user };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(perfilAtualQuery());
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data } = useSuspenseQuery(perfilAtualQuery());
  const isAdmin = data?.isAdmin ?? false;

  if (data?.perfil && data.perfil.ativo === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="card-premium max-w-sm p-6 text-center">
          <BrandLogo size="sm" />
          <p className="mt-4 font-display text-2xl">Conta desativada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu acesso ao Fut Cajazeiras está inativo. Fale com a diretoria para reativar.
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-gold underline"
            onClick={() => {
              void supabase.auth.signOut().then(() => {
                window.location.href = "/auth";
              });
            }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <NotificacoesProvider userId={data?.user.id}>
      <div className="flex min-h-screen flex-col bg-background">
        <BubbleConquista />
        {/* Header mobile */}
        <header className="sticky top-0 z-30 border-b border-border/50 bg-surface/95 backdrop-blur-lg">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <div className="leading-tight">
                <p className="font-display text-lg tracking-wider text-foreground">
                  Fut Cajazeiras
                </p>
                <p className="text-[10px] uppercase tracking-widest text-gold">
                  {data?.rotuloPapel ?? "Convidado"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SinoNotificacoes />
              <Link
                to="/perfil"
                aria-label="Meu perfil"
                title="Meu perfil"
                className="shrink-0 transition-opacity hover:opacity-80"
              >
                <AvatarJogador
                  caminho={data?.perfil?.avatar_url}
                  nome={data?.perfil?.nome}
                  size="sm"
                />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-10">
          <CartinhaProvider>
            <Outlet />
          </CartinhaProvider>
        </main>

        <RodapeApp />

        {/* Espaço reservado para a barra de navegação inferior fixa (não sobrepõe o rodapé) */}
        <div className="h-20 shrink-0" aria-hidden />

        <BottomNav isAdmin={isAdmin} />
      </div>
    </NotificacoesProvider>
  );
}
