import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { AuthLayout } from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, Input, Hint } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { signUpSchema, type SignUpInput } from "@/lib/schemas";
import { useAuth, authErrorMessage } from "@/features/auth/AuthProvider";
import { CampoDeCodigo, useEsperaParaReenviar } from "@/features/auth/CampoDeCodigo";

export default function SignUpPage() {
  const { signUp, confirmSignUp, resendSignUpCode } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [erroDoCodigo, setErroDoCodigo] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const espera = useEsperaParaReenviar();

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

  /*
   * O código vem por e-mail e é conferido aqui mesmo, sem sair da tela.
   *
   * Antes a confirmação era um link: a pessoa saía do app, abria o e-mail,
   * clicava e voltava numa aba nova — e quem se cadastrava no celular com o
   * e-mail em outro aplicativo perdia o contexto no caminho.
   */
  async function conferirCodigo(valor: string) {
    if (valor.length < 6 || conferindo) return;
    setConferindo(true);
    setErroDoCodigo("");
    try {
      await confirmSignUp(getValues("email"), valor);
      navigate("/onboarding", { replace: true });
    } catch (error) {
      setErroDoCodigo(authErrorMessage(error));
      setCodigo("");
    } finally {
      setConferindo(false);
    }
  }

  async function reenviar() {
    if (espera.restam > 0 || reenviando) return;
    setReenviando(true);
    setErroDoCodigo("");
    try {
      await resendSignUpCode(getValues("email"));
      espera.reiniciar();
      setCodigo("");
    } catch (error) {
      setErroDoCodigo(authErrorMessage(error));
    } finally {
      setReenviando(false);
    }
  }

  if (confirmationSent) {
    return (
      <AuthLayout
        eyebrow="Quase lá"
        title={<>Digite o código que enviamos.</>}
        lede="Seis dígitos, válidos por 10 minutos. Depois disso você cai direto na criação da marca."
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <Mail className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              Enviamos para <strong className="text-ink">{getValues("email")}</strong>.
            </p>
          </div>

          <CampoDeCodigo
            valor={codigo}
            aoMudar={(valor) => {
              setCodigo(valor);
              if (erroDoCodigo) setErroDoCodigo("");
            }}
            aoCompletar={conferirCodigo}
            desabilitado={conferindo}
            invalido={Boolean(erroDoCodigo)}
          />

          <InlineError>{erroDoCodigo}</InlineError>

          <Button
            onClick={() => void conferirCodigo(codigo)}
            loading={conferindo}
            disabled={codigo.length < 6}
            className="w-full"
          >
            Confirmar
            {!conferindo && <ArrowRight className="h-4 w-4" aria-hidden />}
          </Button>

          <div className="flex items-center gap-3">
            <Hint>
              {espera.restam > 0
                ? `Não chegou? Você pode reenviar em ${espera.restam}s.`
                : "Não chegou? Verifique o spam."}
            </Hint>
            <button
              type="button"
              onClick={() => void reenviar()}
              disabled={espera.restam > 0 || reenviando}
              className="ml-auto shrink-0 text-[12.5px] text-accent underline-offset-2 hover:underline disabled:text-ink-faint disabled:no-underline"
            >
              {reenviando ? "Reenviando…" : "Reenviar código"}
            </button>
          </div>

          <Button asChild variant="quiet" className="w-full">
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
