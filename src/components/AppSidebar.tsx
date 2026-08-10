import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Calendar,
  Shuffle,
  Wallet,
  ClipboardList,
  Users,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarJogador } from "@/components/AvatarJogador";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  isAdmin: boolean;
  nome?: string | null;
  rotulo?: string | null;
  avatar?: string | null;
}

export function AppSidebar({ isAdmin, nome, rotulo, avatar }: AppSidebarProps) {
  const location = useLocation();

  const itens = [
    { to: "/inicio", label: "Início", Icon: Home },
    { to: "/baba", label: "Baba", Icon: Calendar },
    { to: "/pagamentos", label: "Financeiro", Icon: Wallet },
    ...(isAdmin
      ? [
          { to: "/admin/sorteio", label: "Sorteio", Icon: Shuffle },
          { to: "/admin/estatisticas", label: "Estatísticas", Icon: ClipboardList },
          { to: "/admin/usuarios", label: "Usuários", Icon: Users },
        ]
      : []),
    { to: "/ajuda", label: "Ajuda", Icon: LifeBuoy },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-4">
        <BrandLogo size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-lg tracking-wider">Fut Cajazeiras</p>
          <p className="text-[10px] uppercase tracking-widest text-gold">{rotulo ?? "Convidado"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {itens.map(({ to, label, Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-elevated text-gold"
                  : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-surface-elevated p-3">
          <Link to="/perfil" aria-label="Meu perfil" className="shrink-0">
            <AvatarJogador caminho={avatar} nome={nome} size="sm" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{nome ?? "Jogador"}</p>
            <Link to="/perfil" className="text-xs text-muted-foreground hover:text-foreground">
              Ver perfil
            </Link>
          </div>
          <button
            type="button"
            aria-label="Sair da conta"
            title="Sair"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-background hover:text-primary"
            onClick={() => {
              void supabase.auth.signOut().then(() => {
                window.location.href = "/auth";
              });
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
