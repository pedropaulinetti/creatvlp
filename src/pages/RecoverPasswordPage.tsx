import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, MailCheck } from "lucide-react";
import { z } from "zod";
import { AuthLayout } from "@/pages/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, Input, Hint } from "@/components/ui/field";
import { InlineError, LoadingBlock } from "@/components/ui/states";
import { recoverSchema, newPasswordSchema } from "@/lib/schemas";
import { useAuth, authErrorMessage } from "@/features/auth/AuthProvider";

type RecoverInput = z.infer<typeof recoverSchema>;
type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** Definição da nova senha — só aparece quando o link de recuperação abriu a sessão. */
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
      lede="Depois de salvar, você entra direto no app — sem precisar fazer login de novo."
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
  const { ready, recovering, session, requestPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RecoverInput>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  if (!ready) return <LoadingBlock className="min-h-dvh" label="Verificando o link" />;
  if (recovering && session) return <DefineNewPassword />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError("");
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  if (sent) {
    return (
      <AuthLayout
        eyebrow="E-mail enviado"
        title={<>Confira sua caixa de entrada.</>}
        lede="O link leva direto para a criação de uma nova senha e expira em uma hora."
      >
        <div className="flex flex-col gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-positive-soft">
            <MailCheck className="h-4.5 w-4.5 text-positive" aria-hidden />
          </span>
          <h2 className="text-[18px] font-medium text-ink">Link enviado</h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            Se existe uma conta com <strong className="text-ink">{getValues("email")}</strong>, o link já está a
            caminho.
          </p>
          <Hint>Não chegou em alguns minutos? Verifique o spam antes de pedir de novo.</Hint>
          <Button asChild variant="outline" className="mt-1 w-full">
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
      lede="Informe o e-mail da conta e enviamos um link para criar uma nova senha."
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
          Enviar link
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
