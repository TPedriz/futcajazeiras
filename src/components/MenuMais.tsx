import { Link, useLocation } from "@tanstack/react-router";
import {
  Trophy,
  Target,
  CalendarDays,
  IdCard,
  Shield,
  Shuffle,
  ClipboardList,
  Users,
  Wallet,
  BadgeCheck,
  ListChecks,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvatarJogador } from "@/components/AvatarJogador";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ItemMenu {
  to: string;
  label: string;
  Icon: typeof Trophy;
}

interface MenuMaisProps {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  isAdmin: boolean;
  nome?: string | null;
  rotulo?: string | null;
  avatar?: string | null;
}

/** Funções da comunidade (acesso de todos os jogadores). */
const COMUNIDADE: ItemMenu[] = [
  { to: "/conquistas", label: "Conquistas", Icon: Trophy },
  { to: "/metas", label: "Metas", Icon: Target },
  { to: "/agenda", label: "Agenda", Icon: CalendarDays },
  { to: "/cartinhas", label: "Cartinhas", Icon: IdCard },
];

/** Funções administrativas (somente diretoria). */
const ADMIN: ItemMenu[] = [
  { to: "/admin", label: "Painel Admin", Icon: Shield },
  { to: "/admin/sorteio", label: "Sorteio", Icon: Shuffle },
  { to: "/admin/estatisticas", label: "Estatísticas", Icon: ClipboardList },
  { to: "/admin/usuarios", label: "Usuários", Icon: Users },
  { to: "/admin/agenda", label: "Agenda", Icon: CalendarDays },
  { to: "/admin/metas", label: "Metas", Icon: Target },
  { to: "/admin/financeiro", label: "Financeiro", Icon: Wallet },
  { to: "/admin/cargos", label: "Cargos", Icon: BadgeCheck },
  { to: "/admin/conquistas", label: "Conquistas", Icon: Trophy },
  { to: "/admin/resultados", label: "Resultados", Icon: ListChecks },
];

/**
 * Menu "Mais" da navegação mobile.
 * Abre um bottom sheet com todas as funções agrupadas por categoria de acesso:
 * Comunidade (todos), Administração (somente diretoria) e Conta.
 */
export function MenuMais({ aberto, onAbertoChange, isAdmin, nome, rotulo, avatar }: MenuMaisProps) {
  const location = useLocation();

  const ativo = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");

  const sair = () => {
    void supabase.auth.signOut().then(() => {
      window.location.href = "/auth";
    });
  };

  const Secao = ({ titulo, itens }: { titulo: string; itens: ItemMenu[] }) => (
    <div className="space-y-1">
      <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {titulo}
      </p>
      {itens.map(({ to, label, Icon }) => {
        const ativoLink = ativo(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={() => onAbertoChange(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ativoLink
                ? "bg-surface-elevated text-gold"
                : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-2 py-4 pb-8"
      >
        <SheetHeader className="px-3 text-left">
          <SheetTitle className="font-display text-lg">Todas as funções</SheetTitle>
        </SheetHeader>

        {/* Usuário logado */}
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3">
          <Link
            to="/perfil"
            aria-label="Meu perfil"
            className="shrink-0"
            onClick={() => onAbertoChange(false)}
          >
            <AvatarJogador caminho={avatar} nome={nome} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{nome ?? "Jogador"}</p>
            <p className="text-[10px] uppercase tracking-widest text-gold">
              {rotulo ?? "Convidado"}
            </p>
          </div>
          <Link
            to="/perfil"
            onClick={() => onAbertoChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Ver perfil
          </Link>
        </div>

        <div className="mt-3 space-y-4">
          <Secao titulo="Comunidade" itens={COMUNIDADE} />

          {isAdmin && <Secao titulo="Administração" itens={ADMIN} />}

          <div className="space-y-1 border-t border-border/60 pt-2">
            <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Conta
            </p>
            <Link
              to="/ajuda"
              onClick={() => onAbertoChange(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                ativo("/ajuda")
                  ? "bg-surface-elevated text-gold"
                  : "text-muted-foreground hover:bg-surface-elevated/60 hover:text-foreground",
              )}
            >
              <LifeBuoy className="size-5 shrink-0" />
              <span>Ajuda</span>
            </Link>
            <button
              type="button"
              onClick={sair}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-elevated/60 hover:text-destructive"
            >
              <LogOut className="size-5 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
