import * as React from "react";
import { ImagePlus } from "lucide-react";
import { signedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** O bucket `product-assets` não guarda SVG — o seletor não deve nem oferecer. */
const FORMATOS = "image/png,image/jpeg,image/webp,image/avif";

/**
 * A foto do produto: miniatura e envio no mesmo lugar.
 *
 * Produto sem foto não é exceção, é o caso comum — só loja com catálogo
 * publicado traz imagem, e produto escrito à mão nunca traz. Um quadrado vazio
 * que não faz nada seria só a constatação do problema; este aqui é a saída.
 *
 * Sem foto ele ocupa o mesmo espaço que com foto, de propósito: a lista não
 * pode dançar conforme os produtos tenham ou não imagem.
 */
export function FotoDoProduto({
  nome,
  imagePath,
  imageUrl,
  aoEnviar,
  className,
}: {
  nome: string;
  /** Caminho da nossa cópia no Storage. É a fonte de verdade. */
  imagePath?: string | null;
  /** Endereço na origem — prévia de quem ainda não foi gravado. */
  imageUrl?: string | null;
  aoEnviar: (arquivo: File) => Promise<void>;
  className?: string;
}) {
  const [assinada, setAssinada] = React.useState<string | null>(null);
  const [previa, setPrevia] = React.useState<string | null>(null);
  // A prévia é um endereço de memória: quem a substitui tem de devolvê-la.
  const emMemoria = React.useRef<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [quebrou, setQuebrou] = React.useState(false);

  const descartarPrevia = React.useCallback(() => {
    if (emMemoria.current) URL.revokeObjectURL(emMemoria.current);
    emMemoria.current = null;
    setPrevia(null);
  }, []);

  /*
   * O bucket é privado: a nossa cópia só aparece por URL assinada. Enquanto ela
   * não chega, quem segura a tela é a prévia local do arquivo recém-escolhido —
   * sem isso, a foto some por um instante logo depois de a pessoa enviá-la.
   */
  React.useEffect(() => {
    let vivo = true;
    if (!imagePath) {
      setAssinada(null);
      return;
    }
    signedUrl("product-assets", imagePath).then((url) => {
      if (!vivo) return;
      setAssinada(url);
      setQuebrou(false);
      if (url) descartarPrevia();
    });
    return () => {
      vivo = false;
    };
  }, [imagePath, descartarPrevia]);

  React.useEffect(() => () => descartarPrevia(), [descartarPrevia]);

  const foto = quebrou ? null : (assinada ?? previa ?? imageUrl ?? null);
  const rotulo = `${foto ? "Trocar" : "Enviar"} foto de ${nome || "produto"}`;

  return (
    <label
      title={rotulo}
      className={cn(
        "group relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-[7px] border border-line",
        foto ? "" : "hatch border-dashed",
        enviando && "pointer-events-none opacity-60",
        className,
      )}
    >
      {foto ? (
        <img
          src={foto}
          alt={nome || "Produto"}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setQuebrou(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-muted transition-colors group-hover:text-ink">
          <ImagePlus className="h-4 w-4" aria-hidden />
        </span>
      )}

      <input
        type="file"
        accept={FORMATOS}
        aria-label={rotulo}
        className="sr-only"
        disabled={enviando}
        onChange={async (evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = "";
          if (!arquivo) return;

          descartarPrevia();
          const local = URL.createObjectURL(arquivo);
          emMemoria.current = local;
          setPrevia(local);
          setQuebrou(false);
          setEnviando(true);
          try {
            await aoEnviar(arquivo);
          } finally {
            setEnviando(false);
          }
        }}
      />
    </label>
  );
}
