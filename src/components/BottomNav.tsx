import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Calendar, Wallet, User, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuMais } from "@/components/MenuMais";

interface NavItem {
  to: string;
  label: string;
  Icon: typeof Home;
}

/** Rotas atendidas pelo menu "Mais" — destacam o botão quando ativo. */
const ROTAS_DO_MAIS = ["/conquistas", "/metas", "/agenda", "/cartinhas", "/ajuda", "/admin"];

interface BottomNavProps {
  isAdmin: boolean;
  nome?: string | null;
  rotulo?: string | null;
  avatar?: string | null;
}

export function BottomNav({ isAdmin, nome, rotulo, avatar }: BottomNavProps) {
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);

  const items: NavItem[] = [
    { to: "/inicio", label: "Início", Icon: Home },
    { to: "/baba", label: "Baba", Icon: Calendar },
    { to: "/pagamentos", label: "Financeiro", Icon: Wallet },
    { to: "/perfil", label: "Perfil", Icon: User },
  ];

  const ativoMais = ROTAS_DO_MAIS.some(
    (r) => location.pathname === r || location.pathname.startsWith(r + "/"),
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/90 backdrop-blur-lg safe-bottom md:hidden">
        <ul className="mx-auto flex max-w-md items-center justify-around px-1 py-1">
          {items.map(({ to, label, Icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-all",
                    active ? "scale-110 text-gold" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("size-5", active && "drop-shadow-[0_0_8px_rgba(217,167,86,0.6)]")}
                  />
                  <span className="leading-none">{label}</span>
                </Link>
              </li>
            );
          })}

          {/* Botão Mais — abre o menu com todas as funções */}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu com todas as funções"
              className={cn(
                "flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-all",
                ativoMais ? "scale-110 text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid
                className={cn("size-5", ativoMais && "drop-shadow-[0_0_8px_rgba(217,167,86,0.6)]")}
              />
              <span className="leading-none">Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <MenuMais
        aberto={menuAberto}
        onAbertoChange={setMenuAberto}
        isAdmin={isAdmin}
        nome={nome}
        rotulo={rotulo}
        avatar={avatar}
      />
    </>
  );
}
