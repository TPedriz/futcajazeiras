import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { perfilAtualQuery } from "@/lib/babaQueries";
import { BrandLogo } from "@/components/BrandLogo";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header mobile */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-surface/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <div className="leading-tight">
              <p className="font-display text-lg tracking-wider text-foreground">Fut Cajazeiras</p>
              <p className="text-[10px] uppercase tracking-widest text-gold">
                {data?.rotuloPapel ?? "Convidado"}
              </p>
            </div>
          </div>
          <SinoNotificacoes userId={data?.user.id} />
        </div>
      </header>


      <main className="mx-auto max-w-md px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
