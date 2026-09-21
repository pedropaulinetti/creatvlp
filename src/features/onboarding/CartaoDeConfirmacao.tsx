import * as React from "react";
import { Check, ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListaDeFontes } from "@/features/brand/ListaDeFontes";
import { CorDaPaleta } from "@/features/brand/CorDaPaleta";
import { CamposDoProduto, GaleriaDoProduto } from "@/features/brand/CamposDoProduto";
import { Field, Hint, Input, MonoLabel, Textarea } from "@/components/ui/field";
import { InlineError, Notice } from "@/components/ui/states";
import { FotoDoProduto } from "@/components/FotoDoProduto";
import { prettyUrl } from "@/lib/url";
import { cn } from "@/lib/utils";
import { useSignedUrls } from "@/features/creatives/useAssetUrls";
import { formatarPreco } from "./SequenciaDeLeitura";
import type { Draft, Leitura } from "./tipos";

/**
 * A única tela entre a leitura e o app.
 *
 * Tudo o que foi encontrado aparece de uma vez, editável no lugar. Não há
 * etapas: quem quiser só olhar e confirmar leva alguns segundos, quem quiser
 * corrigir corrige aqui mesmo. O resto se completa depois em Minha Marca.
 */
export function CartaoDeConfirmacao({
  draft,
  leitura,
  aplicar,
  aoConfirmar,
  aoEnviarLogo,
  aoEnviarFotoDeProduto,
  aoRemoverFotoDeProduto,
  aoTornarFotoPrincipal,
  aoEnviarFonte,
  aoRecomecar,
  salvando,
  erro,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
  aoConfirmar: () => void;
  aoEnviarLogo: (arquivo: File) => Promise<void>;
  aoEnviarFotoDeProduto: (indice: number, arquivo: File) => Promise<void>;
  aoRemoverFotoDeProduto: (indice: number, caminho: string) => void;
  aoTornarFotoPrincipal: (indice: number, caminho: string) => void;
  aoEnviarFonte: (arquivo: File, familia: string) => Promise<void>;
  aoRecomecar: () => void;
  salvando: boolean;
  erro: string;
}) {
  const podeConcluir = draft.company.trim().length >= 2 && draft.products.some((p) => p.name.trim());

  return (
    <div className="flex w-full max-w-[680px] flex-col gap-6">
      <header className="surgir flex flex-col gap-2.5">
        <MonoLabel className="text-accent">
          {draft.website ? `Lido de ${prettyUrl(draft.website)}` : "Da nossa conversa"}
        </MonoLabel>
        <h1 className="text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-[38px]">
          Encontramos sua marca.
        </h1>
        <Hint>
          Confira e ajuste o que quiser. Nada foi gravado ainda — e o que faltar você
          completa depois em Minha Marca.
        </Hint>
      </header>

      {!leitura.funcaoAtual && (
        <Notice tone="warning">
          A leitura veio da versão anterior da função publicada — por isso paleta, logo e
          imagens não batem com o que este app espera. Publique as Edge Functions
          (<code className="font-mono text-[12px]">npm run functions:deploy</code>) e leia o
          site de novo.
        </Notice>
      )}

      {!leitura.textoOk && (
        <Notice tone="warning">
          A descrição e o tom de voz não puderam ser interpretados. Confira esses dois campos
          com atenção.
        </Notice>
      )}

      <section
        className="surgir flex flex-col gap-5 rounded-[14px] border border-line-strong bg-card p-5"
        style={{ animationDelay: "70ms" }}
      >
        <Identidade
          draft={draft}
          leitura={leitura}
          aplicar={aplicar}
          aoEnviarLogo={aoEnviarLogo}
          aoEnviarFonte={aoEnviarFonte}
        />

        <div className="h-px bg-line-soft" />

        <Field label="Nome da marca" htmlFor="rev-company">
          <Input
            id="rev-company"
            value={draft.company}
            onChange={(evento) => aplicar({ company: evento.target.value })}
            placeholder="Minas Estate Coffee"
          />
        </Field>

        <Field label="O que a marca faz" htmlFor="rev-description" optional>
          <Textarea
            id="rev-description"
            rows={2}
            className="min-h-[64px]"
            value={draft.description}
            onChange={(evento) => aplicar({ description: evento.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Segmento" htmlFor="rev-segment" optional>
            <Input
              id="rev-segment"
              value={draft.segment}
              onChange={(evento) => aplicar({ segment: evento.target.value })}
            />
          </Field>
          <Field label="Tom de voz" htmlFor="rev-tone" optional>
            <Input
              id="rev-tone"
              value={draft.voiceTone}
              onChange={(evento) => aplicar({ voiceTone: evento.target.value })}
              placeholder="Próximo e informativo"
            />
          </Field>
        </div>

        <Produtos
          draft={draft}
          leitura={leitura}
          aplicar={aplicar}
          aoEnviarFoto={aoEnviarFotoDeProduto}
          aoRemoverFoto={aoRemoverFotoDeProduto}
          aoTornarPrincipal={aoTornarFotoPrincipal}
        />

        <Field label="Quem compra de você" htmlFor="rev-audience" optional>
          <Textarea
            id="rev-audience"
            rows={2}
            className="min-h-[64px]"
            value={draft.audience}
            onChange={(evento) => aplicar({ audience: evento.target.value })}
            placeholder="Quem é a pessoa, o que ela busca e o que a faz comprar."
          />
        </Field>
      </section>

      <InlineError>{erro}</InlineError>

      <div className="surgir flex flex-wrap items-center gap-3" style={{ animationDelay: "140ms" }}>
        <Button variant="quiet" onClick={aoRecomecar} disabled={salvando}>
          Ler outro endereço
        </Button>
        <Button className="ml-auto" size="lg" onClick={aoConfirmar} loading={salvando} disabled={!podeConcluir}>
          {!salvando && <Sparkles className="h-4 w-4" aria-hidden />}
          É isso, criar marca
        </Button>
      </div>

      {!podeConcluir && (
        <Hint className="text-right">
          Falta o nome da marca e ao menos um produto.
        </Hint>
      )}
    </div>
  );
}

/** Paleta, tipografia e logo: a parte que a pessoa confirma olhando, não lendo. */
function Identidade({
  draft,
  leitura,
  aplicar,
  aoEnviarLogo,
  aoEnviarFonte,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
  aoEnviarLogo: (arquivo: File) => Promise<void>;
  aoEnviarFonte: (arquivo: File, familia: string) => Promise<void>;
}) {
  const urlsDasFontes = useSignedUrls(
    "brand-assets",
    draft.fontFiles.filter((fonte) => !fonte.url).map((fonte) => fonte.path),
  );

  /*
   * A prévia mostra o logo GUARDADO, não o que a leitura achou no site.
   *
   * Mostrava `leitura.logoUrl` sempre. Quem clicava em "Trocar logo" e
   * escolhia um arquivo via a mesma imagem de antes: o upload acontecia, o
   * caminho ia para o rascunho, e a tela não mudava nada. Indistinguível de
   * não funcionar, e convidava a enviar de novo achando que tinha falhado.
   *
   * `logoPath` é o que foi guardado, venha da leitura ou do envio à mão. O
   * endereço do site fica de prévia imediata, para o instante entre achar e
   * guardar, e para quando a assinatura falha.
   */
  const urlDoLogo = useSignedUrls("brand-assets", [draft.logoPath]);
  const logoVisivel = urlDoLogo.data?.get(draft.logoPath ?? "") ?? leitura.logoUrl;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <MonoLabel>
          Paleta · {draft.colors.length} {draft.colors.length === 1 ? "cor" : "cores"}
          {leitura.folhas > 0 && ` de ${leitura.folhas} ${leitura.folhas === 1 ? "folha" : "folhas"} de estilo`}
        </MonoLabel>

        <div className="flex flex-wrap gap-1.5">
          {draft.colors.map((cor, index) => (
            <CorDaPaleta
              key={`${cor.hex}-${index}`}
              cor={cor}
              atraso={Math.min(index, 9) * 45}
              aoMudar={(valores) =>
                aplicar({
                  colors: draft.colors.map((item, i) => (i === index ? { ...item, ...valores } : item)),
                })
              }
              aoRemover={() => aplicar({ colors: draft.colors.filter((_, i) => i !== index) })}
            />
          ))}

          {/*
            Acrescentar faltava: a leitura pega o que está na folha de estilo, e
            a cor que a marca usa só no impresso, ou que ainda vai usar, não
            estava em lugar nenhum.
          */}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-contrast px-3 py-1 text-[12px] text-ink-muted transition-colors hover:border-accent hover:text-ink">
            <Plus className="h-3 w-3" aria-hidden />
            Cor
            <input
              type="color"
              className="sr-only"
              onChange={(evento) =>
                aplicar({
                  colors: [...draft.colors, { hex: evento.target.value.toUpperCase(), role: "apoio", label: "" }],
                })
              }
            />
          </label>
        </div>

        {!draft.colors.length && (
          <Hint>Nenhuma cor foi encontrada no site. Acrescente ao menos a principal.</Hint>
        )}
      </div>

      <Referencias draft={draft} leitura={leitura} aplicar={aplicar} />

      <ListaDeFontes
        /*
         * No rascunho o arquivo já está no Storage, mas ainda não há linha em
         * `brand_assets` — o caminho serve de identificador até concluir.
         *
         * A fonte enviada agora tem prévia em memória; a que veio da leitura do
         * site precisa de URL assinada, e é ela que faz o nome da família
         * aparecer escrito na própria letra.
         */
        fontes={draft.fontFiles.map((fonte) => ({
          id: fonte.path,
          familia: fonte.familia,
          url: fonte.url ?? urlsDasFontes.data?.get(fonte.path) ?? null,
        }))}
        tipografia={draft.typography}
        aoMudarPapel={(papel, familia) =>
          aplicar({ typography: { ...draft.typography, [papel]: familia } })
        }
        aoEnviar={aoEnviarFonte}
        aoRemover={(id) =>
          aplicar({ fontFiles: draft.fontFiles.filter((fonte) => fonte.path !== id) })
        }
      />

      <div className="flex flex-col gap-2">
        <MonoLabel>Logo</MonoLabel>
        <div className="flex flex-wrap items-center gap-3">
          {(draft.logoPath || leitura.logoUrl) && (
            <Logo url={logoVisivel} guardada={Boolean(draft.logoPath)} />
          )}
          {/*
            O envio aparece sempre, e não só quando a leitura falha: quando ela
            acerta o arquivo errado — um ícone, um selo de pagamento — trocar
            aqui evita carregar a logo errada até Minha Marca.
          */}
          <EnvioDeLogo aoEnviar={aoEnviarLogo} temLogo={Boolean(draft.logoPath || leitura.logoUrl)} />
        </div>
      </div>
    </div>
  );
}

/**
 * As imagens do site que ficam guardadas com a marca.
 *
 * Eram guardadas em bloco e mostradas só as quatro primeiras — sem como
 * descartar a que não serve. Elas entram na geração como referência de luz e
 * clima, então uma foto de banner promocional ou de rodapé puxa a peça inteira
 * para o lugar errado.
 */
function Referencias({
  draft,
  leitura,
  aplicar,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
}) {
  /*
   * A prévia e o caminho guardado vêm em listas separadas, na mesma ordem.
   * O par é montado uma vez para que remover uma não desalinhe o resto.
   */
  const todas = React.useMemo(
    () =>
      (leitura.imagens.length ? leitura.imagens : draft.referencePaths).map((url, indice) => ({
        url,
        path: draft.referencePaths[indice] ?? "",
      })),
    // Só na primeira montagem: depois disso quem manda é a seleção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leitura.imagens.length],
  );

  if (!todas.length) return null;

  const escolhida = (path: string) => !path || draft.referencePaths.includes(path);

  return (
    <div className="flex flex-col gap-2">
      <MonoLabel>Referências visuais · {draft.referencePaths.length}</MonoLabel>

      <div className="flex flex-wrap gap-2">
        {todas.slice(0, 8).map((item, indice) => {
          const dentro = escolhida(item.path);
          return (
            <button
              key={item.url + indice}
              type="button"
              aria-pressed={dentro}
              aria-label={dentro ? `Descartar referência ${indice + 1}` : `Usar referência ${indice + 1}`}
              onClick={() =>
                aplicar({
                  referencePaths: dentro
                    ? draft.referencePaths.filter((caminho) => caminho !== item.path)
                    : [...draft.referencePaths, item.path],
                })
              }
              className={cn(
                "surgir relative h-16 w-16 overflow-hidden rounded-[8px] border transition-all",
                dentro ? "border-accent" : "border-line opacity-40 grayscale",
              )}
              style={{ animationDelay: `${indice * 60}ms` }}
            >
              <img
                src={item.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(evento) => {
                  evento.currentTarget.style.display = "none";
                }}
              />
              {dentro && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-surface"
                >
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Hint>
        Entram na geração como referência de luz e clima. Clique para descartar a que não representa
        a marca.
      </Hint>
    </div>
  );
}

/** O logo à vista, a partir do endereço de origem. */
function Logo({ url, guardada }: { url: string; guardada: boolean }) {
  const [quebrou, setQuebrou] = React.useState(false);

  if (!url || quebrou) {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
        <Check className="h-3.5 w-3.5 text-positive" aria-hidden />
        Logo importada
      </span>
    );
  }

  return (
    <span className="hatch flex h-14 min-w-14 items-center justify-center rounded-[8px] border border-line px-2">
      <img
        src={url}
        alt={guardada ? "Logo importada do site" : "Logo encontrada no site"}
        className="max-h-10 w-auto max-w-[150px] object-contain"
        onError={() => setQuebrou(true)}
      />
    </span>
  );
}

/**
 * Sem site — ou com site sem logo próprio — não há de onde importar a marca.
 * Este é o único envio de arquivo que sobrou no onboarding: o resto se faz
 * depois, com calma, em Minha Marca.
 */
function EnvioDeLogo({
  aoEnviar,
  temLogo = false,
}: {
  aoEnviar: (arquivo: File) => Promise<void>;
  temLogo?: boolean;
}) {
  const [enviando, setEnviando] = React.useState(false);

  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink">
      <ImagePlus className="h-3.5 w-3.5" aria-hidden />
      {enviando ? "Enviando logo…" : temLogo ? "Trocar logo" : "Enviar logo"}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        disabled={enviando}
        onChange={async (evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = "";
          if (!arquivo) return;
          setEnviando(true);
          await aoEnviar(arquivo);
          setEnviando(false);
        }}
      />
    </label>
  );
}

function Produtos({
  draft,
  leitura,
  aplicar,
  aoEnviarFoto,
  aoRemoverFoto,
  aoTornarPrincipal,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
  aoEnviarFoto: (indice: number, arquivo: File) => Promise<void>;
  aoRemoverFoto: (indice: number, caminho: string) => void;
  aoTornarPrincipal: (indice: number, caminho: string) => void;
}) {
  /*
   * Um produto aberto por vez. Dez produtos com preço, link, destaques e
   * galeria abertos ao mesmo tempo viram uma tela de rolagem infinita na qual
   * ninguém acha o que veio conferir.
   */
  const [aberto, setAberto] = React.useState<number | null>(null);

  return (
    <Field
      label={`Produtos${draft.products.length ? ` · ${draft.products.length}` : ""}`}
      hint={
        leitura.loja
          ? "Importados da sua loja. Abra um produto para corrigir preço, fotos e destaques."
          : "Adicione ao menos um produto ou serviço, e abra para pôr foto e preço."
      }
    >
      <div className="flex flex-col gap-1.5">
        {draft.products.map((produto, index) => {
          const caminhos = produto.imagePaths ?? (produto.imagePath ? [produto.imagePath] : []);
          const estaAberto = aberto === index;

          return (
            <div
              key={index}
              className={cn(
                "surgir flex flex-col gap-3 rounded-[10px] border transition-colors",
                estaAberto ? "border-line-strong bg-card p-3" : "border-transparent",
              )}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <div className="flex items-center gap-2">
                <FotoDoProduto
                  nome={produto.name}
                  imagePath={produto.imagePath ?? caminhos[0]}
                  imageUrl={produto.imageUrl}
                  aoEnviar={(arquivo) => aoEnviarFoto(index, arquivo)}
                />
                <Input
                  value={produto.name}
                  aria-label={`Produto ${index + 1}`}
                  onChange={(evento) => {
                    const proximos = [...draft.products];
                    proximos[index] = { ...produto, name: evento.target.value };
                    aplicar({ products: proximos });
                  }}
                />

                {typeof produto.priceCents === "number" && !estaAberto && (
                  <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">
                    {formatarPreco(produto.priceCents, produto.currency || leitura.moeda)}
                  </span>
                )}

                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  aria-expanded={estaAberto}
                  onClick={() => setAberto(estaAberto ? null : index)}
                >
                  {estaAberto ? "Fechar" : "Editar"}
                </Button>

                <Button
                  type="button"
                  variant="quiet"
                  size="iconLg"
                  aria-label={`Remover ${produto.name || `produto ${index + 1}`}`}
                  onClick={() => {
                    aplicar({ products: draft.products.filter((_, i) => i !== index) });
                    setAberto(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>

              {estaAberto && (
                <>
                  <GaleriaDoProduto
                    nome={produto.name}
                    caminhos={caminhos}
                    aoEnviar={(arquivo) => aoEnviarFoto(index, arquivo)}
                    aoRemover={(caminho) => aoRemoverFoto(index, caminho)}
                    aoTornarPrincipal={(caminho) => aoTornarPrincipal(index, caminho)}
                  />

                  <CamposDoProduto
                    valores={{
                      name: produto.name,
                      description: produto.description,
                      priceCents: produto.priceCents ?? null,
                      currency: produto.currency || leitura.moeda,
                      url: produto.url ?? "",
                      highlights: produto.highlights ?? [],
                    }}
                    aoMudar={(valores) => {
                      const proximos = [...draft.products];
                      proximos[index] = {
                        ...produto,
                        ...(valores.description !== undefined && { description: valores.description }),
                        ...(valores.priceCents !== undefined && { priceCents: valores.priceCents }),
                        ...(valores.currency !== undefined && { currency: valores.currency }),
                        ...(valores.url !== undefined && { url: valores.url }),
                        ...(valores.highlights !== undefined && { highlights: valores.highlights }),
                      };
                      aplicar({ products: proximos });
                    }}
                  />
                </>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            aplicar({ products: [...draft.products, { name: "", description: "" }] });
            setAberto(draft.products.length);
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar produto
        </Button>
      </div>
    </Field>
  );
}
