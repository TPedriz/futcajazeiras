import { Link, useLocation } from "@tanstack/react-router";
import { Home, Calendar, Shield, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  Icon: typeof Home;
}

interface BottomNavProps {
  isAdmin: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const location = useLocation();
  const items: NavItem[] = [
    { to: "/inicio", label: "Início", Icon: Home },
    { to: "/baba", label: "Baba", Icon: Calendar },
    { to: "/pagamentos", label: "Pagamentos", Icon: Wallet },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", Icon: Shield }] : []),
    { to: "/perfil", label: "Perfil", Icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-lg safe-bottom">
      <ul className={cn("mx-auto flex max-w-md items-stretch justify-around px-1 pt-2")}>
        {items.map(({ to, label, Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors",
                  active
                    ? "text-gold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_rgba(217,167,86,0.6)]")} />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
