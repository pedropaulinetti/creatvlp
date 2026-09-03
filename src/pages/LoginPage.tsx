import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { signInSchema, type SignInInput } from "@/lib/schemas";
import { useAuth, authErrorMessage } from "@/features/auth/AuthProvider";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError("");
    try {
      await signIn(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith("/app") ? from : "/app", { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Entrar"
      title={<>Sua mesa de testes criativos está aberta.</>}
      lede="Marca, campanhas, criativos e aprendizados continuam exatamente onde você parou."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="text-accent hover:underline">
            Criar uma conta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="text-[18px] font-medium text-ink">Entrar no CreatvOS</h2>

        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="voce@empresa.com.br"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Sua senha"
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[7px] text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </div>
        </Field>

        <InlineError>{formError}</InlineError>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          Entrar
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>

        <Link to="/recuperar-senha" className="text-center text-[12.5px] text-ink-muted hover:text-accent">
          Esqueci minha senha
        </Link>
      </form>
    </AuthLayout>
  );
}
