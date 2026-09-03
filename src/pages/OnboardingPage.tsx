import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Globe } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Field, Hint, Input, MonoLabel } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { uploadBrandFile, validateImageFile } from "@/lib/storage";
import { looksLikeUrl, normalizeUrl } from "@/lib/url";
import { greeting } from "@/lib/utils";
import { CartaoDeConfirmacao } from "@/features/onboarding/CartaoDeConfirmacao";
import { ConversaComIA } from "@/features/onboarding/ConversaComIA";
import { SequenciaDeLeitura } from "@/features/onboarding/SequenciaDeLeitura";
import { camposDaLeitura } from "@/features/onboarding/camposDaLeitura";
import { useRascunho } from "@/features/onboarding/rascunho";
import { mensagemDeFalha, salvarMarca } from "@/features/onboarding/salvarMarca";
import { respostaRendeu, useLeituraDoSite } from "@/features/onboarding/useLeituraDoSite";

/**
 * Configuração inicial em três momentos: o endereço, a leitura e a confirmação.
 *
 * Não há etapas a percorrer. O site responde quase tudo — paleta, tipografia,
 * logo e catálogo — e à pessoa cabe conferir. Quem não tem site conversa com a
 * IA e desemboca na mesma confirmação.
 */
type Fase = "site" | "lendo" | "confirmacao" | "conversa";

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { workspaceId, loading: carregandoConta, refresh } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { draft, aplicar, retomado, limpar, descartar } = useRascunho();
  const { leitura, lendo, erro: erroLeitura, setErro, ler } = useLeituraDoSite({
    workspaceId,
    brandId: draft.brandId,
  });

  /*
   * Sempre começa pelo endereço, mesmo havendo rascunho salvo.
   *
   * Pular direto para a confirmação parecia gentil e era uma armadilha: depois
   * da primeira tentativa o site nunca mais era lido, e nenhuma correção de
   * leitura chegava à tela. Quem tem rascunho vê a opção de continuar — e
   * decide.
   */
  const [fase, setFase] = React.useState<Fase>("site");
  const [salvando, setSalvando] = React.useState(false);
  const [erroAoSalvar, setErroAoSalvar] = React.useState("");

  async function analisar(enderecoDireto?: string) {
    const bruto = (enderecoDireto ?? draft.website).trim();
    if (!bruto) {
      setErro("Informe o endereço do site para analisarmos.");
      return;
    }
    const endereco = normalizeUrl(bruto);
    if (!looksLikeUrl(endereco)) {
      setErro("Endereço incompleto. Escreva o domínio inteiro, como suamarca.com.br");
      return;
    }

    setFase("lendo");
    const resposta = await ler(endereco);
    if (!resposta) {
      setFase("site"); // a mensagem do erro já está na tela do endereço
      return;
    }

    aplicar(camposDaLeitura(endereco, resposta, draft));

    if (respostaRendeu(resposta)) {
      setFase("confirmacao");
      const catalogo = resposta.catalog ?? resposta.shopify;
      toast.success(
        catalogo?.products.length
          ? `Catálogo lido: ${catalogo.products.length} produtos importados.`
          : "Lemos seu site. Confira o que encontramos.",
      );
    } else {
      setFase("conversa");
      toast.message("A leitura trouxe pouca coisa. Me conta você.");
    }
  }

  async function enviarLogo(arquivo: File) {
    if (!workspaceId) return;
    const validacao = validateImageFile(arquivo);
    if (!validacao.ok) {
      setErroAoSalvar(validacao.reason);
      return;
    }
    setErroAoSalvar("");
    try {
      const caminho = await uploadBrandFile({
        bucket: "brand-assets",
        workspaceId,
        brandId: draft.brandId,
        resourceType: "logo",
        file: arquivo,
      });
      aplicar({ logoPath: caminho });
    } catch (falha) {
      setErroAoSalvar(falha instanceof Error ? falha.message : "Não foi possível enviar o arquivo.");
    }
  }

  /*
   * A foto do produto, quando o site não tinha nenhuma para dar.
   *
   * Segue o mesmo caminho do logo: quem tem o `workspaceId` é a página, então é
   * daqui que o arquivo sobe. O rascunho guarda o caminho e o `salvarMarca` já
   * sabe gravá-lo junto do produto.
   */
  async function enviarFotoDeProduto(indice: number, arquivo: File) {
    if (!workspaceId) return;
    // O bucket de produto não guarda SVG.
    const validacao = validateImageFile(arquivo, { allowSvg: false });
    if (!validacao.ok) {
      setErroAoSalvar(validacao.reason);
      return;
    }
    setErroAoSalvar("");
    try {
      const caminho = await uploadBrandFile({
        bucket: "product-assets",
        workspaceId,
        brandId: draft.brandId,
        resourceType: "produto",
        file: arquivo,
      });
      const produtos = draft.products.map((produto, i) =>
        i === indice ? { ...produto, imagePath: caminho } : produto,
      );
      aplicar({ products: produtos });
    } catch (falha) {
      setErroAoSalvar(falha instanceof Error ? falha.message : "Não foi possível enviar o arquivo.");
    }
  }

  async function concluir() {
    if (!workspaceId || !user) return;
    setSalvando(true);
    setErroAoSalvar("");
    try {
      await salvarMarca({ draft, workspaceId, userId: user.id });
      limpar();
      localStorage.setItem("creatvos:brand", draft.brandId);
      await Promise.all([refreshProfile(), refresh(), queryClient.invalidateQueries()]);
      toast.success("Marca criada. Bem-vindo ao CreatvOS.");
      navigate("/app", { replace: true });
    } catch (falha) {
      setErroAoSalvar(mensagemDeFalha(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-[60px] shrink-0 items-center gap-4 px-5 md:px-10">
        <Logo height={18} />
        <span aria-hidden className="hidden h-4 w-px bg-line md:block" />
        <MonoLabel className="hidden md:inline">Configuração inicial</MonoLabel>
      </header>

      <main className="flex flex-1 justify-center px-5 py-8 md:px-10 md:py-10">
        {fase === "site" && (
          <TelaDoEndereco
            website={draft.website}
            nome={profile?.full_name}
            erro={erroLeitura}
            lendo={lendo}
            pronta={Boolean(workspaceId) && !carregandoConta}
            rascunho={retomado && draft.company.trim() ? draft.company.trim() : ""}
            aoMudar={(website) => aplicar({ website })}
            aoAnalisar={analisar}
            aoRetomar={() => setFase("confirmacao")}
            aoDescartar={descartar}
            aoConversar={() => {
              setErro("");
              setFase("conversa");
            }}
          />
        )}

        {fase === "lendo" && (
          <div className="flex w-full max-w-[560px] flex-col gap-7 self-center">
            <div className="flex flex-col gap-2.5">
              <MonoLabel className="text-accent">Lendo</MonoLabel>
              <h1 className="text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-[36px]">
                Estamos dentro do seu site.
              </h1>
            </div>
            <SequenciaDeLeitura leitura={leitura} />
          </div>
        )}

        {fase === "confirmacao" && (
          <CartaoDeConfirmacao
            draft={draft}
            leitura={leitura}
            aplicar={aplicar}
            aoConfirmar={concluir}
            aoEnviarLogo={enviarLogo}
            aoEnviarFotoDeProduto={enviarFotoDeProduto}
            aoRecomecar={() => {
              setErro("");
              setFase("site");
            }}
            salvando={salvando}
            erro={erroAoSalvar}
          />
        )}

        {fase === "conversa" && (
          <ConversaComIA
            workspaceId={workspaceId}
            aplicar={aplicar}
            aoConcluir={() => setFase("confirmacao")}
            aoVoltar={() => setFase("site")}
          />
        )}
      </main>
    </div>
  );
}

/** A porta de entrada: um campo só, e colar já dispara a leitura. */
function TelaDoEndereco({
  website,
  nome,
  erro,
  lendo,
  pronta,
  rascunho,
  aoMudar,
  aoAnalisar,
  aoRetomar,
  aoDescartar,
  aoConversar,
}: {
  website: string;
  nome?: string | null;
  erro: string;
  lendo: boolean;
  /** A conta já tem workspace: antes disso não há para onde mandar a leitura. */
  pronta: boolean;
  rascunho: string;
  aoMudar: (valor: string) => void;
  aoAnalisar: (endereco?: string) => void;
  aoRetomar: () => void;
  aoDescartar: () => void;
  aoConversar: () => void;
}) {
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-7 self-center">
      <div className="surgir flex flex-col gap-3">
        <MonoLabel className="text-accent">
          {greeting()}
          {nome?.trim() ? `, ${nome.trim().split(" ")[0]}` : ""}
        </MonoLabel>
        <h1 className="text-[32px] font-normal leading-[1.08] tracking-[-0.03em] text-ink md:text-[42px]">
          Vamos começar pelo seu site.
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          Cole o endereço e a gente monta a memória da marca: paleta, tipografia, logo e — se
          for loja — o catálogo inteiro. Você só confere.
        </p>
      </div>

      <form
        className="surgir flex flex-col gap-3"
        style={{ animationDelay: "80ms" }}
        onSubmit={(evento) => {
          evento.preventDefault();
          aoAnalisar();
        }}
      >
        <Field label="Endereço do site" htmlFor="website">
          <div className="flex gap-2">
            <Input
              id="website"
              autoFocus
              value={website}
              onChange={(evento) => aoMudar(evento.target.value)}
              onPaste={(evento) => {
                // Colar o endereço já dispara a leitura: é o gesto natural.
                const colado = evento.clipboardData.getData("text");
                if (looksLikeUrl(colado)) {
                  evento.preventDefault();
                  const endereco = normalizeUrl(colado);
                  aoMudar(endereco);
                  window.setTimeout(() => aoAnalisar(endereco), 0);
                }
              }}
              onBlur={() => website.trim() && aoMudar(normalizeUrl(website))}
              placeholder="suamarca.com.br"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              className="h-11 text-[15px]"
            />
            <Button
              type="submit"
              size="lg"
              loading={lendo || !pronta}
              disabled={!looksLikeUrl(website) || !pronta}
              className="shrink-0"
            >
              {pronta && !lendo && <Globe className="h-4 w-4" aria-hidden />}
              {lendo ? "Lendo" : "Analisar"}
            </Button>
          </div>
        </Field>

        <InlineError>{erro}</InlineError>
        {erro ? (
          // Site fora do ar, protegido contra leitura ou vazio: a saída é a
          // conversa, e ela precisa estar à mão — não no rodapé da tela.
          <Button variant="outline" size="sm" className="self-start" onClick={aoConversar}>
            Me conta você
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : (
          <Hint>Levamos alguns segundos: lemos as folhas de estilo e o catálogo inteiro.</Hint>
        )}
      </form>

      {rascunho && (
        <div className="surgir flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-surface px-4 py-3">
          <span className="text-[13px] text-ink-2">
            Você tinha começado com <strong className="font-medium">{rascunho}</strong>.
          </span>
          <Button variant="outline" size="sm" onClick={aoRetomar}>
            Continuar de onde parei
          </Button>
          <Button variant="ghost" size="sm" onClick={aoDescartar} className="px-1">
            Descartar
          </Button>
        </div>
      )}

      <div className="surgir flex items-center gap-3 border-t border-line-soft pt-5" style={{ animationDelay: "160ms" }}>
        <Button variant="ghost" onClick={aoConversar} className="px-0">
          Não tenho site — me conta você
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
