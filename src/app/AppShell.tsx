import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronsUpDown,
  CircleDot,
  Home,
  Library,
  LogOut,
  PanelLeft,
  Plus,
  RotateCw,
  Settings,
  Gauge,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { BrandSwitcher } from "@/app/BrandSwitcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useNotifications } from "@/features/notifications/useNotifications";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Início", short: "Início", icon: Home, end: true },
  { to: "/app/rotinas", label: "Rotinas", short: "Rotinas", icon: RotateCw, end: false },
  { to: "/app/biblioteca", label: "Biblioteca", short: "Biblioteca", icon: Library, end: false },
  { to: "/app/marca", label: "Minha Marca", short: "Marca", icon: CircleDot, end: false },
] as const;

const BREADCRUMB: Record<string, string> = {
  "/app": "Início",
  "/app/campanhas": "Campanhas",
  "/app/rotinas": "Rotinas",
  "/app/biblioteca": "Biblioteca",
  "/app/marca": "Minha Marca",
  "/app/configuracoes": "Configurações",
};

function useBreadcrumb() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/app/campanhas/")) return "Campanha";
  return BREADCRUMB[pathname.replace(/\/$/, "")] ?? "Início";
}

function NotificationsMenu() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={unread ? `Notificações, ${unread} não lidas` : "Notificações"}
        className="relative flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        <Bell className="h-[15px] w-[15px]" aria-hidden />
        {unread > 0 && (
          <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[330px]">
        <div className="flex items-center justify-between px-2.5 pb-1 pt-2">
          <span className="label-mono">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-[11.5px] text-accent hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[12.5px] text-ink-muted">
            Nada por aqui ainda. Avisaremos quando uma campanha ou rotina precisar de você.
          </p>
        ) : (
          <div className="scroll-slim max-h-[340px] overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => {
                  if (!item.read_at) markRead.mutate(item.id);
                  if (item.link) navigate(item.link);
                }}
                className="items-start"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    item.read_at ? "bg-line-contrast" : "bg-accent",
                  )}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] leading-snug text-ink">{item.title}</span>
                  {item.body && <span className="text-[12px] leading-snug text-ink-muted">{item.body}</span>}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.email || "Você";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left transition-colors hover:bg-hover",
          collapsed && "justify-center px-0",
        )}
        aria-label="Menu da conta"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line-strong text-[10.5px] text-ink">
          {initials(name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{name}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate("/app/configuracoes")}>
          <Settings className="h-3.5 w-3.5" aria-hidden />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/app/configuracoes#consumo")}>
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          Consumo e plano
        </DropdownMenuItem>
        {profile?.platform_role === "admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/admin")}>
              <PanelLeft className="h-3.5 w-3.5" aria-hidden />
              Administração
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          tone="danger"
          onSelect={() => {
            void signOut().then(() => navigate("/login"));
          }}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(
    () => localStorage.getItem("creatvos:sidebar") === "collapsed",
  );
  const breadcrumb = useBreadcrumb();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();

  const toggle = () => {
    setCollapsed((value) => {
      localStorage.setItem("creatvos:sidebar", value ? "open" : "collapsed");
      return !value;
    });
  };

  return (
    <div className="flex min-h-dvh bg-paper">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-ink focus:px-3 focus:py-2 focus:text-[13px] focus:text-surface"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar — só em telas médias para cima (o mobile usa a barra inferior) */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col px-3 pb-3.5 pt-[18px] md:flex",
          collapsed ? "w-[68px]" : "w-[216px]",
        )}
      >
        <div className={cn("px-2 pb-[22px] pt-1", collapsed && "px-0 text-center")}>
          <NavLink to="/app" aria-label="CreatvOS, ir para o início">
            {collapsed ? <Logo height={16} className="mx-auto max-w-[40px] object-left object-cover" /> : <Logo />}
          </NavLink>
        </div>

        <Button
          size="md"
          className={cn("mb-3 w-full justify-start gap-2.5", collapsed && "justify-center px-0")}
          onClick={() => navigate("/app/campanhas/nova")}
          aria-label="Criar campanha"
        >
          <Plus className="h-[15px] w-[15px] shrink-0" aria-hidden />
          {!collapsed && "Criar campanha"}
        </Button>

        <nav className="flex flex-col gap-0.5" aria-label="Navegação principal">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-active font-medium text-ink"
                    : "text-ink-muted hover:bg-hover hover:text-ink",
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" aria-hidden strokeWidth={1.6} />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* Inset */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface md:my-2 md:mr-2 md:rounded-[12px] md:border md:border-line">
        <header className="flex h-[52px] shrink-0 items-center gap-2.5 px-4 md:px-[18px]">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}
            className="hidden h-7 w-7 items-center justify-center rounded-[7px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink md:flex"
          >
            <PanelLeft className="h-[15px] w-[15px]" aria-hidden strokeWidth={1.7} />
          </button>
          <span aria-hidden className="hidden h-4 w-px bg-line md:block" />

          <NavLink to="/app" className="md:hidden" aria-label="CreatvOS">
            <Logo height={14} />
          </NavLink>

          <div className="hidden items-center gap-2 text-[12.5px] text-ink-faint md:flex">
            <span className="max-w-[160px] truncate">{workspace?.name ?? "CreatvOS"}</span>
            <span aria-hidden className="text-line-contrast">/</span>
            <span className="text-ink">{breadcrumb}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationsMenu />
            <BrandSwitcher />
            <span className="md:hidden">
              <UserMenu collapsed />
            </span>
          </div>
        </header>

        <main id="conteudo" className="scroll-slim min-h-0 flex-1 overflow-y-auto pb-[62px] md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Navegação inferior — mobile */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[62px] items-center justify-around border-t border-line-soft bg-surface px-2.5 md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-w-[64px] flex-col items-center gap-1 rounded-[8px] py-1.5 text-[10px] transition-colors",
                isActive ? "text-ink" : "text-ink-faint",
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden strokeWidth={1.6} />
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
