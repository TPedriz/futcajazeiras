import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { perfilAtualQuery } from "@/lib/babaQueries";
import {
  CalendarPlus,
  Wallet,
  Shuffle,
  ChevronLeft,
  Trophy,
  UserCog,
  Users,
  BookOpen,
  ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel Admin — Fut Cajazeiras" },
      {
        name: "description",
        content:
          "Ferramentas administrativas do Fut Cajazeiras: agendar sessões do baba, controlar mensalidades e sortear os times.",
      },
      { property: "og:title", content: "Painel Admin — Fut Cajazeiras" },
      {
        property: "og:description",
        content: "Diretoria do Fut Cajazeiras: gestão de sessões, financeiro e sorteio de times.",
      },
    ],
  }),

  beforeLoad: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(perfilAtualQuery());
    if (!data?.isAdmin) throw redirect({ to: "/inicio" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="space-y-5">
      <Link
        to="/inicio"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <div>
        <p className="text-xs uppercase tracking-widest text-gold">Diretoria</p>
        <h1 className="font-display text-4xl">Painel Admin</h1>
      </div>
      <nav className="grid grid-cols-4 gap-2">
        <AdminTab to="/admin" label="Sessões" Icon={CalendarPlus} />
        <AdminTab to="/admin/financeiro" label="Financeiro" Icon={Wallet} />
        <AdminTab to="/admin/sorteio" label="Sorteio" Icon={Shuffle} />
        <AdminTab to="/admin/resultados" label="Resultados" Icon={Trophy} />
        <AdminTab to="/admin/estatisticas" label="Estatísticas" Icon={ClipboardList} />
        <AdminTab to="/admin/conquistas" label="Conquistas" Icon={Trophy} />
        <AdminTab to="/admin/cargos" label="Cargos" Icon={UserCog} />
        <AdminTab to="/admin/usuarios" label="Usuários" Icon={Users} />
        <AdminTab to="/admin/ajuda" label="Ajuda" Icon={BookOpen} />
      </nav>

      <Outlet />
    </div>
  );
}

function AdminTab({ to, label, Icon }: { to: string; label: string; Icon: typeof CalendarPlus }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground transition-colors data-[status=active]:border-gold/60 data-[status=active]:bg-gold/10 data-[status=active]:text-gold"
    >
      {({ isActive }) => (
        <>
          <Icon className={`size-5 ${isActive ? "text-gold" : ""}`} />
          <span className="font-semibold uppercase tracking-widest">{label}</span>
        </>
      )}
    </Link>
  );
}
