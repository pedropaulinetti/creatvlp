import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { LoadingBlock, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { canAccessAdmin } from "@/lib/permissions";

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center px-6">{children}</div>;
}

export function RequireSupabase({ children }: { children: React.ReactNode }) {
  const { configured } = useAuth();
  if (configured) return <>{children}</>;
  return (
    <FullPage>
      <ErrorState
        title="Configuração pendente"
        description="Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e reinicie o servidor. O README explica o passo a passo."
      />
    </FullPage>
  );
}

/** Exige sessão ativa. Guarda a rota pretendida para voltar depois do login. */
/** Versão de rota: bloqueia a subárvore inteira quando falta configuração. */
export function RequireSupabaseOutlet() {
  return (
    <RequireSupabase>
      <Outlet />
    </RequireSupabase>
  );
}

export function RequireAuth() {
  const { ready, session, profile, signOut } = useAuth();
  const location = useLocation();

  if (!ready) return <FullPage><LoadingBlock label="Verificando seu acesso" /></FullPage>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  /*
   * Só bloqueia diante do estado explícito. Enquanto o perfil não chegou ele é
   * nulo, e tratar nulo como bloqueado faria a tela piscar em todo carregamento.
   * A trava que vale está na Edge Function; esta aqui é para a pessoa entender
   * o que houve em vez de ver tudo falhar.
   */
  if (profile?.access_status === "bloqueado") {
    return (
      <FullPage>
        <div className="flex max-w-[420px] flex-col items-start gap-4">
          <ErrorState
            title="Conta bloqueada"
            description={
              profile.blocked_reason
                ? `Motivo: ${profile.blocked_reason}. Fale com quem administra o CreatvOS para reativar.`
                : "Fale com quem administra o CreatvOS para reativar seu acesso."
            }
          />
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </FullPage>
    );
  }

  return <Outlet />;
}

/** Exige onboarding concluído — e uma marca criada, que é a base de tudo. */
export function RequireOnboarding() {
  const { profile, ready } = useAuth();
  const { loading, brands, error, refresh } = useWorkspace();

  if (!ready || loading) return <FullPage><LoadingBlock label="Abrindo seu workspace" /></FullPage>;
  if (error) {
    return (
      <FullPage>
        <ErrorState
          title="Não conseguimos abrir seu workspace"
          description="Pode ter sido uma falha de conexão. Tente carregar novamente."
          onRetry={() => void refresh()}
        />
      </FullPage>
    );
  }
  if (!profile?.onboarding_completed_at || brands.length === 0) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Bloqueio de UI. A proteção real está na RLS e nas Edge Functions. */
export function RequireAdmin() {
  const { ready, session, profile } = useAuth();

  if (!ready) return <FullPage><LoadingBlock label="Verificando permissões" /></FullPage>;
  if (!session) return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  if (!canAccessAdmin(profile?.platform_role)) {
    return (
      <FullPage>
        <ErrorState
          title="Acesso restrito"
          description="Esta área é reservada à administração da plataforma. Se você deveria ter acesso, fale com quem administra o CreatvOS."
        />
      </FullPage>
    );
  }
  return <Outlet />;
}

/** Se já está logado, /login e /cadastro redirecionam para dentro do app. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { ready, session, recovering } = useAuth();
  if (!ready) return <FullPage><LoadingBlock label="Carregando" /></FullPage>;
  if (session && !recovering) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function NotFound() {
  return (
    <FullPage>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="label-mono">Erro 404</span>
        <h1 className="text-[28px] font-normal tracking-tight text-ink">Esta página não existe</h1>
        <p className="max-w-[46ch] text-[14px] text-ink-muted">
          O endereço pode ter mudado de lugar. Volte para o início e continue de lá.
        </p>
        <Button asChild>
          <a href="/app">Ir para o início</a>
        </Button>
      </div>
    </FullPage>
  );
}
