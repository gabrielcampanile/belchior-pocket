import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeftRight, BarChart3, LayoutDashboard, Link2, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useAutoSync } from "@/hooks/useOpenFinanceSync";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CurrencySelect } from "@/components/finance/CurrencySelect";

// v1: balanço mensal com Open Finance. Planejamento, cenários, patrimônio etc. são v2
// (telas de referência em legacy/lovable-screens).
const NAV = [
  { to: "/", label: "Mês atual", icon: LayoutDashboard },
  { to: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/conexoes", label: "Conexões", icon: Link2 },
] as const;

/**
 * Mobile first: on a phone the app is used installed (standalone), so the shell respects the
 * notch / home-indicator safe areas, the bottom tab bar is the only navigation (no duplicate
 * hamburger menu) and every tap target is at least 44px tall.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useAutoSync();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar px-3 py-6 lg:flex">
        <BrandMark />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} active={pathname === item.to} />
          ))}
        </nav>
        <Button
          variant="ghost"
          className="justify-start gap-2 text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <BrandMark compact />
        <div className="ml-auto flex items-center gap-1">
          <CurrencySelect />
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground"
            onClick={handleSignOut}
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="hidden lg:ml-60 lg:flex lg:justify-end lg:px-10 lg:pt-6">
        <CurrencySelect />
      </div>

      <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:ml-60 lg:px-10 lg:pb-14 lg:pt-4">
        <div className="mx-auto w-full max-w-6xl space-y-6 lg:space-y-8">{children}</div>
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-12 place-items-center rounded-full transition-colors",
                  active && "bg-primary/10",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-2">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
        B
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">Belchior</p>
        {!compact ? (
          <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            Personal Finance OS
          </p>
        ) : null}
      </div>
    </div>
  );
}
