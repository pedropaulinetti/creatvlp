import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** true quando o usuário chegou por link de recuperação de senha */
  recovering: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);

/** Traduz os erros do Supabase Auth para português, sem vazar detalhes internos. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered") || message.includes("already been registered"))
    return "Já existe uma conta com esse e-mail. Tente entrar.";
  if (message.includes("password should be at least")) return "A senha precisa de pelo menos 8 caracteres.";
  if (message.includes("email address") && message.includes("invalid"))
    return "Esse e-mail não é aceito. Use um endereço de e-mail válido.";
  if (message.includes("email rate limit") || message.includes("over_email_send_rate_limit"))
    return "Muitos e-mails enviados nesta hora. Aguarde alguns minutos e tente de novo.";
  if (message.includes("rate limit") || message.includes("too many"))
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (message.includes("signups not allowed") || message.includes("signup_disabled"))
    return "Os cadastros estão temporariamente fechados.";
  if (message.includes("failed to fetch") || message.includes("networkerror"))
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  if (message.includes("same_password")) return "A nova senha precisa ser diferente da anterior.";
  return "Algo não deu certo. Tente novamente em instantes.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(!isSupabaseConfigured);
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [recovering, setRecovering] = React.useState(
    () => typeof window !== "undefined" && window.location.hash.includes("type=recovery"),
  );

  const loadProfile = React.useCallback(async (userId: string | undefined) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data ?? null);
  }, []);

  React.useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadProfile(data.session?.user.id).finally(() => active && setReady(true));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      setSession(nextSession);
      void loadProfile(nextSession?.user.id);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = React.useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      recovering,
      configured: isSupabaseConfigured,
      async signIn(email, password) {
        if (!supabase) throw new Error("Supabase não configurado");
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
      },
      async signUp(fullName, email, password) {
        if (!supabase) throw new Error("Supabase não configurado");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        setProfile(null);
      },
      async requestPasswordReset(email) {
        if (!supabase) throw new Error("Supabase não configurado");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/recuperar-senha`,
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        if (!supabase) throw new Error("Supabase não configurado");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecovering(false);
        window.history.replaceState({}, "", window.location.pathname);
      },
      async refreshProfile() {
        await loadProfile(session?.user.id);
      },
    }),
    [ready, session, profile, recovering, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
