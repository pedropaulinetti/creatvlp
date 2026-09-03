import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, Input, Hint } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { signUpSchema, type SignUpInput } from "@/lib/schemas";
import { useAuth, authErrorMessage } from "@/features/auth/AuthProvider";

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError("");
    try {
      const { needsConfirmation } = await signUp(values.fullName, values.email, values.password);
      if (needsConfirmation) setConfirmationSent(true);
      else navigate("/onboarding", { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  if (confirmationSent) {
    return (
      <AuthLayout
        eyebrow="Quase lá"
        title={<>Confirme seu e-mail para começar.</>}
        lede="Enviamos um link de confirmação. Ele abre direto no onboarding da sua marca."
      >
        <div className="flex flex-col gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-positive-soft">
            <Check className="h-4.5 w-4.5 text-positive" aria-hidden />
          </span>
          <h2 className="text-[18px] font-medium text-ink">E-mail enviado</h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            Enviamos a confirmação para <strong className="text-ink">{getValues("email")}</strong>. Abra o link e
            você entra direto na criação da marca.
          </p>
          <Hint>Não chegou? Verifique o spam ou aguarde um minuto antes de tentar de novo.</Hint>
          <Button asChild variant="outline" className="mt-1 w-full">
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Criar conta"
      title={<>Comece pela marca. O resto vem da conversa.</>}
      lede="Em poucos minutos o CreatvOS conhece seu produto, seu público e seu tom — e passa a propor testes."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="text-[18px] font-medium text-ink">Criar sua conta</h2>

        <Field label="Nome" htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            autoFocus
            placeholder="Como podemos te chamar"
            aria-invalid={Boolean(errors.fullName)}
            {...register("fullName")}
          />
        </Field>

        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          label="Senha"
          htmlFor="password"
          error={errors.password?.message}
          hint="Pelo menos 8 caracteres, com letras e números."
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Crie uma senha"
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
          Criar conta
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
