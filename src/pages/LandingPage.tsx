import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Layers, Lock, Palette, Wallet } from "lucide-react";
import logo from "@/assets/logo-ink.svg?url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHELL = "mx-auto w-full max-w-5xl px-6";

/* ------------------------------------------------------------------ peças */

const FORMATS = [
  { label: "4:5", ratio: 0.8, note: "feed" },
  { label: "1:1", ratio: 1, note: "quadrado" },
  { label: "9:16", ratio: 0.5625, note: "stories" },
];

/** A fotografia gerada. É a mesma em todas as peças, e esse é o ponto. */
function Scene() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{ background: "linear-gradient(174deg,#f2c795 0%,#dd9265 30%,#9c5740 60%,#3d221c 100%)" }}
    >
      <span
        className="absolute -right-[8%] -top-[12%] h-[48%] w-[58%] rounded-full"
        style={{ background: "radial-gradient(closest-side,#fff4dbcc,#fff4db00)" }}
      />
      <span className="absolute inset-x-0 bottom-0 h-[30%] border-t border-white/15 bg-gradient-to-b from-transparent to-[#1c0f0c66]" />
      <span
        className="absolute bottom-[25%] left-[27%] h-[8%] w-[46%] rounded-full"
        style={{ background: "radial-gradient(closest-side,#2b150fd9,#2b150f00)" }}
      />
      <span
        className="absolute bottom-[28%] left-[34%] h-[40%] w-[32%]"
        style={{
          background: "linear-gradient(104deg,#fffaf0 0%,#f7ddb6 24%,#d99c6f 60%,#8c5338 100%)",
          borderRadius: "48% 48% 30% 30% / 56% 56% 16% 16%",
          boxShadow: "inset -7px -9px 20px #6b3a2866, inset 7px 9px 18px #fff4e055, 0 14px 34px #2b150f73",
        }}
      >
        <span className="absolute left-[21%] top-[11%] h-[52%] w-[11%] rounded-full bg-gradient-to-b from-white/85 to-transparent blur-[1.5px]" />
      </span>
    </div>
  );
}

type Kind = "produto" | "beneficio" | "oferta";

function Overlay({ kind }: { kind: Kind }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#1c0f0cb3] from-0% via-transparent via-40% to-[#1c0f0cf2] p-3">
      <span className="inline-flex rounded-md border border-white/20 bg-[#1c0f0c]/70 px-1.5 py-1 font-mono text-[7.5px] tracking-[0.16em] text-[#fffdfa]">
        SUA MARCA
      </span>

      <div className="absolute inset-x-3 bottom-3">
        {kind === "produto" && (
          <>
            <p className="text-[13px] font-semibold leading-tight text-white">A luz certa para a sua sala</p>
            <p className="mt-1 text-[10px] leading-snug text-[#f0e4d8]">Luminária Aurora · linha 2026</p>
          </>
        )}
        {kind === "beneficio" && (
          <>
            <p className="text-[13px] font-semibold leading-tight text-white">Acende em 2 segundos, dura 9 anos</p>
            <ul className="mt-1.5 space-y-0.5 text-[10px] text-[#f0e4d8]">
              <li>Regulagem em 5 tons</li>
              <li>Instala sem furar</li>
            </ul>
          </>
        )}
        {kind === "oferta" && (
          <>
            <div className="flex items-baseline gap-1.5">
              <b className="font-serif text-[26px] font-normal leading-none text-[#ffd9a8]">R$ 189</b>
              <s className="text-[10px] text-[#d9cec4]">R$ 279</s>
            </div>
            <p className="mt-1 text-[10px] text-[#f0e4d8]">Frete grátis acima de R$ 150</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#fffdfa] px-2 py-1 text-[9px] font-semibold text-[#171412]">
              Comprar agora <ChevronRight className="size-2.5" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Piece({
  kind,
  height,
  ratio,
  className,
}: {
  kind: Kind;
  height: number;
  ratio: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl shadow-pop transition-[width,height] duration-500 ease-out",
        className,
      )}
      style={{ height, width: Math.round(height * ratio) }}
    >
      <Scene />
      <Overlay kind={kind} />
    </div>
  );
}

/** As peças aprovadas ficam nítidas na frente; as outras variações recuam. */
function PieceCluster() {
  const [format, setFormat] = useState(FORMATS[0]);

  const depths: Array<{ kind: Kind; h: number; cls: string }> = [
    { kind: "beneficio", h: 196, cls: "-mr-5 translate-y-9 opacity-45 blur-[3px]" },
    { kind: "produto", h: 246, cls: "-mr-4 translate-y-4 opacity-90 blur-[1.5px]" },
    { kind: "oferta", h: 300, cls: "z-10" },
    { kind: "beneficio", h: 246, cls: "-ml-4 translate-y-4 opacity-90 blur-[1.5px]" },
    { kind: "produto", h: 196, cls: "-ml-5 translate-y-9 opacity-45 blur-[3px]" },
  ];

  return (
    <>
      <div className="relative mt-14 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_16%,#000_84%,transparent)] sm:mt-20">
        <div className="flex items-end justify-center pb-6">
          {depths.map((d, i) => (
            <Piece key={i} kind={d.kind} height={d.h} ratio={format.ratio} className={d.cls} />
          ))}
        </div>
      </div>

      <div className={cn(SHELL, "mt-6 flex flex-col items-center gap-4")}>
        <div className="flex gap-1.5" role="group" aria-label="Formato das peças">
          {FORMATS.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={format.label === item.label}
              onClick={() => setFormat(item)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] transition-colors duration-150",
                format.label === item.label
                  ? "bg-ink text-surface"
                  : "text-ink-muted ring-1 ring-ink/10 hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="max-w-sm text-center text-[13.5px] leading-relaxed text-ink-muted">
          Uma foto do produto, três composições e o formato de {format.note} muda sem gerar nada de novo.
        </p>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- header */

function SoonButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-2 text-[13px] font-medium text-accent-ink opacity-100 ring-1 ring-accent/15",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
      Em breve
    </button>
  );
}

const NAV = [
  ["Como funciona", "#como-funciona"],
  ["O que muda", "#o-que-muda"],
  ["Perguntas", "#perguntas"],
];

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-colors duration-300",
        scrolled && "border-b border-ink/5 bg-canvas/75 backdrop-blur-lg",
      )}
    >
      <div className={cn(SHELL, "relative flex items-center justify-between py-5")}>
        <a href="#inicio" aria-label="CreatvOS">
          <img src={logo} alt="CreatvOS" className="h-[18px] w-auto" />
        </a>

        <nav className="absolute inset-0 m-auto hidden size-fit lg:block">
          <ul className="flex gap-1">
            {NAV.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  className="rounded-full px-3 py-1.5 text-[13.5px] text-ink-muted transition-colors duration-150 hover:bg-ink/5 hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-full text-[13px]">
            <Link to="/login">Entrar</Link>
          </Button>
          <SoonButton className="max-sm:hidden" />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="inicio" className="pb-24 pt-32 md:pb-32 md:pt-44">
      <div className={cn(SHELL, "text-center")}>
        <h1 className="mx-auto max-w-xl text-balance font-serif text-[36px] font-medium leading-[1.06] tracking-[-0.015em] sm:text-5xl">
          Cole o endereço. Saia com anúncios prontos.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-balance text-[15px] leading-relaxed text-ink-muted">
          Dê o endereço do seu site. O CreatvOS lê a sua marca, entende o catálogo e devolve peças montadas
          para testar em mídia paga.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <SoonButton />
          <span className="text-[13px] text-ink-faint">Em beta fechado com operações reais.</span>
        </div>
      </div>

      <PieceCluster />
    </section>
  );
}

/* ---------------------------------------------------------- como funciona */

function SectionHead({ kicker, title, children }: { kicker?: string; title: string; children?: string }) {
  return (
    <div className="mx-auto max-w-lg text-center">
      {kicker && <span className="text-[13px] font-medium text-accent">{kicker}</span>}
      <h2 className={cn("text-balance font-serif text-[28px] font-medium leading-tight tracking-[-0.015em] sm:text-[36px]", kicker && "mt-2")}>
        {title}
      </h2>
      {children && <p className="mt-4 text-balance text-[15px] leading-relaxed text-ink-muted">{children}</p>}
    </div>
  );
}

const STEPS = [
  {
    label: "Marca",
    title: "Comece pelo endereço do site",
    body: "O CreatvOS lê a paleta direto do CSS, a tipografia, a logo e as imagens, e o catálogo inteiro quando a loja é Shopify. Você confere tudo em uma tela só. Sem site, a IA pergunta só o que faltou.",
  },
  {
    label: "Briefing",
    title: "Responda no máximo três perguntas",
    body: "Cada uma vem com respostas prontas tiradas da sua própria marca: os produtos cadastrados, os públicos, os canais que você usa.",
  },
  {
    label: "Caminhos",
    title: "Escolha os ângulos que merecem virar imagem",
    body: "De três a cinco caminhos criativos com copy chegam antes de qualquer imagem existir. Você marca os que quer ver virar peça e vê o custo antes de confirmar.",
  },
  {
    label: "Peças",
    title: "Uma imagem vira três peças",
    body: "O modelo desenha só a cena, a partir da foto real do produto. Headline, preço, CTA e logo o CreatvOS compõe por cima, então mudar de formato não gera nada.",
  },
  {
    label: "Rotina",
    title: "O que funcionou volta na próxima rodada",
    body: "A biblioteca guarda ângulo, copy, custo, formato e status. As rotinas repetem o trabalho no ritmo que você definir, com a geração automática desligada por padrão.",
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-ink/5 py-24 md:py-32">
      <div className={SHELL}>
        <SectionHead kicker="Como funciona" title="Do catálogo à campanha, em cinco passos">
          Não é um gerador de imagens. É a operação criativa inteira, com você decidindo a cada passo.
        </SectionHead>

        <div className="mx-auto mt-14 max-w-2xl divide-y divide-ink/[0.07]">
          {STEPS.map((step) => (
            <article key={step.label} className="grid gap-1.5 py-7 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-8">
              <span className="pt-0.5 text-[13px] font-medium text-accent">{step.label}</span>
              <div>
                <h3 className="text-[16.5px] font-medium tracking-[-0.01em]">{step.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ o que muda */

const CHANGES = [
  {
    icon: Palette,
    title: "Sua marca, não um template",
    body: "Paleta, tipografia, logo e referências visuais lidas do seu site orientam cada peça. O resultado continua reconhecível como seu.",
  },
  {
    icon: Wallet,
    title: "O custo aparece antes",
    body: "Você vê quantos créditos serão consumidos, o que é mantido e o que é criado. Nada roda sem a sua confirmação.",
  },
  {
    icon: Layers,
    title: "Mais testes por produto",
    body: "A mesma oferta ganha ângulos, mensagens e formatos diferentes sem que ninguém precise começar do zero.",
  },
  {
    icon: Lock,
    title: "Seus arquivos são seus",
    body: "Workspaces isolados no banco, arquivos privados por URL assinada temporária e chave de IA que nunca passa pelo navegador.",
  },
];

function Changes() {
  return (
    <section id="o-que-muda" className="border-t border-ink/5 bg-paper py-24 md:py-32">
      <div className={SHELL}>
        <SectionHead kicker="O que muda" title="Mais variedade sem virar template" />

        <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
          {CHANGES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl bg-surface p-6 shadow-raise ring-1 ring-ink/[0.065]">
              <Icon className="size-[18px] text-accent" strokeWidth={1.6} />
              <h3 className="mt-4 text-[16px] font-medium tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- perguntas */

const FAQS: Array<[string, string]> = [
  [
    "Quando dá para usar?",
    "Estamos em beta fechado, testando com um grupo pequeno de operações reais antes de abrir. É por isso que os botões ainda dizem Em breve.",
  ],
  [
    "Preciso ter site para começar?",
    "Ajuda muito, porque é dele que saem paleta, tipografia, logo e catálogo. Mas não é obrigatório: quem não tem site escreve um parágrafo do próprio jeito e a IA pergunta só o que ainda falta.",
  ],
  [
    "O CreatvOS substitui meu designer?",
    "Não. Ele tira do time o trabalho repetitivo de produzir variação em cima de variação. As decisões de marca e a curadoria continuam com quem entende do assunto, e toda peça passa por aprovar, rejeitar com motivo ou editar.",
  ],
  [
    "Quanto custa gerar uma campanha?",
    "Depende de quantos caminhos você aprova. Cada caminho consome uma imagem e devolve três peças em três formatos. O custo estimado aparece antes de você confirmar.",
  ],
  [
    "A IA escreve o texto direto na imagem?",
    "Não. O modelo desenha apenas a cena. Headline, preço, CTA e logo são compostos pelo CreatvOS por cima da fotografia, e é por isso que o texto sai legível e o formato pode mudar sem gerar nada de novo.",
  ],
];

function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="perguntas" className="border-t border-ink/5 py-24 md:py-32">
      <div className={SHELL}>
        <SectionHead title="Antes de colocar a máquina para rodar" />

        <div className="mx-auto mt-14 max-w-2xl divide-y divide-ink/[0.07] border-y border-ink/[0.07]">
          {FAQS.map(([question, answer], index) => {
            const expanded = open === index;
            return (
              <article key={question}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? -1 : index)}
                  className="flex w-full items-center gap-6 py-5 text-left"
                >
                  <span className="flex-1 text-[15.5px] font-medium tracking-[-0.01em]">{question}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-ink-faint transition-transform duration-200",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded && <p className="-mt-1 pb-6 pr-10 text-[14.5px] leading-relaxed text-ink-2">{answer}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ fecho e pé */

function Closing() {
  return (
    <section className="border-t border-ink/5 py-24 text-center md:py-32">
      <div className={SHELL}>
        <h2 className="mx-auto max-w-[16ch] text-balance font-serif text-[28px] font-medium leading-tight tracking-[-0.015em] sm:text-[36px]">
          Seu catálogo não deveria ficar sem ideias novas
        </h2>
        <p className="mx-auto mt-4 max-w-sm text-balance text-[15px] leading-relaxed text-ink-muted">
          Estamos testando com poucas operações antes de abrir. Vale voltar aqui em breve.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <SoonButton />
          <span className="text-[13px] text-ink-faint">
            Já participa do beta?{" "}
            <Link to="/login" className="text-accent-ink underline underline-offset-4">
              Entrar
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/5 py-10">
      <div className={cn(SHELL, "flex flex-col items-center gap-5 sm:flex-row sm:justify-between")}>
        <img src={logo} alt="CreatvOS" className="h-[17px] w-auto opacity-70" />
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-ink-muted">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="transition-colors duration-150 hover:text-ink">
              {label}
            </a>
          ))}
          <Link to="/login" className="transition-colors duration-150 hover:text-ink">
            Entrar
          </Link>
        </nav>
        <span className="text-[12.5px] text-ink-faint">© {new Date().getFullYear()} CreatvOS · Brasil</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ página */

export default function LandingPage() {
  const root = useRef<HTMLElement>(null);

  // Âncoras suaves sem tocar no app, que é estático de propósito.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const html = document.documentElement;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = "";
    };
  }, []);

  return (
    <main ref={root} className="overflow-x-hidden">
      <Header />
      <Hero />
      <HowItWorks />
      <Changes />
      <FAQ />
      <Closing />
      <Footer />
    </main>
  );
}
