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
    <div className="min-h-screen bg-background">
      <BubbleConquista userId={data?.user.id} />

      <AppSidebar
        isAdmin={isAdmin}
        nome={data?.perfil?.nome}
        rotulo={data?.rotuloPapel}
        avatar={data?.perfil?.avatar_url}
      />

      {/* Header mobile */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-border bg-surface/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo size="sm" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-lg tracking-wider text-foreground">Fut Cajazeiras</p>
              <p className="text-[10px] uppercase tracking-widest text-gold">
                {data?.rotuloPapel ?? "Convidado"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SinoNotificacoes userId={data?.user.id} />
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

      <div className="flex min-h-screen flex-col pt-16 pb-20 md:ml-64 md:pt-0 md:pb-0">
        {/* Barra superior desktop */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-end border-b border-border/50 bg-surface/90 px-6 backdrop-blur-lg md:flex">
          <SinoNotificacoes userId={data?.user.id} />
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-10 md:max-w-4xl md:px-8">
          <CartinhaProvider>
            <Outlet />
          </CartinhaProvider>
        </main>

        <RodapeApp />
      </div>

      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
