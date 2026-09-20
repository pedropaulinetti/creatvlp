import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Mail } from "lucide-react";
import { z } from "zod";
import { AuthLayout } from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, Input, Hint } from "@/components/ui/field";
import { InlineError, LoadingBlock } from "@/components/ui/states";
import { recoverSchema, newPasswordSchema } from "@/lib/schemas";
import { useAuth, authErrorMessage } from "@/features/auth/AuthProvider";
import { CampoDeCodigo, useEsperaParaReenviar } from "@/features/auth/CampoDeCodigo";

type RecoverInput = z.infer<typeof recoverSchema>;
type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** Definição da nova senha. Só aparece depois que o código foi conferido. */
function DefineNewPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError("");
    try {
      await updatePassword(values.password);
      navigate("/app", { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Nova senha"
      title={<>Defina a senha que vai usar daqui em diante.</>}
      lede="Depois de salvar, você entra direto no app, sem precisar fazer login de novo."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="text-[18px] font-medium text-ink">Criar nova senha</h2>

        <Field label="Nova senha" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="Mínimo de 8 caracteres"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Field label="Confirmar senha" htmlFor="confirm" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Digite novamente"
            aria-invalid={Boolean(errors.confirm)}
            {...register("confirm")}
          />
        </Field>

        <InlineError>{formError}</InlineError>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          Salvar senha
          {!isSubmitting && <Check className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function RecoverPasswordPage() {
  const { ready, recovering, session, requestPasswordReset, confirmPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");
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
  } = useForm<RecoverInput>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  if (!ready) return <LoadingBlock className="min-h-dvh" label="Verificando a sessão" />;
  if (recovering && session) return <DefineNewPassword />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError("");
    try {
      await requestPasswordReset(values.email);
      espera.reiniciar();
      setSent(true);
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  /*
   * O código é conferido aqui mesmo. Quando dá certo, `confirmPasswordReset`
   * abre a sessão de recuperação e a tela troca sozinha para a nova senha.
   */
  async function conferirCodigo(valor: string) {
    if (valor.length < 6 || conferindo) return;
    setConferindo(true);
    setErroDoCodigo("");
    try {
      await confirmPasswordReset(getValues("email"), valor);
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
      await requestPasswordReset(getValues("email"));
      espera.reiniciar();
      setCodigo("");
    } catch (error) {
      setErroDoCodigo(authErrorMessage(error));
    } finally {
      setReenviando(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        eyebrow="Confira seu e-mail"
        title={<>Digite o código que enviamos.</>}
        lede="Seis dígitos, válidos por 10 minutos. Depois deles você já define a nova senha."
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <Mail className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              Se existe uma conta com <strong className="text-ink">{getValues("email")}</strong>, o código já
              está a caminho.
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
      eyebrow="Recuperar acesso"
      title={<>Vamos devolver sua entrada.</>}
      lede="Informe o e-mail da conta e enviamos um código de seis dígitos para criar uma nova senha."
      footer={
        <>
          Lembrou a senha?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="text-[18px] font-medium text-ink">Recuperar senha</h2>

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

        <InlineError>{formError}</InlineError>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          Enviar código
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
