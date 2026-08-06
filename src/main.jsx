import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Layers3, Menu, MessageCircle, Play, Plus, Search, WandSparkles, X, Zap } from "lucide-react";
import logo from "./assets/logo.svg?url";
import cityBridge from "./assets/hero-city.png";
import tag from "./assets/TAG.svg?url";
import "./index.css";

function SoftButton({ children, light = false, onClick, type = "button", className = "" }) {
  return <button type={type} onClick={onClick} className={`soft-button ${light ? "light" : ""} ${className}`}>{children}</button>;
}

function Header({ onJoin }) {
  return <header className="header hero-only-header"><a className="brand" href="/"><img src={logo} alt="CreatvOS"/></a><span className="header-note">CRIATIVIDADE EM ESCALA · BRASIL</span><SoftButton light onClick={onJoin}>Participar da pesquisa <ArrowRight size={14}/></SoftButton></header>;
}

function Hero({ onJoin }) {
  return <section id="inicio" className="hero hero-only"><div className="hero-image"><img src={cityBridge} alt="Ponte Estaiada em São Paulo ao pôr do sol"/><div/></div><div className="hero-content"><div className="news-pill"><span>Em construção</span> Feito para marcas brasileiras</div><h1>Transforme seus produtos em anúncios para <em>testar em escala.</em></h1><p>O CreatvOS cria variações de anúncios a partir dos seus produtos, ofertas e identidade de marca.<br/>Mais caminhos criativos para descobrir o que realmente vende.</p><div className="hero-actions"><SoftButton light onClick={onJoin}>Participar da pesquisa <ArrowRight size={15}/></SoftButton></div><small><Check size={12}/> Pesquisa de descoberta · sem oferta comercial</small></div><img className="hero-tag" src={tag} alt="Build by KickOS"/></section>;
}

const formats=["UGC","ESTÁTICOS","HOOKS","VÍDEOS","OFERTAS","CARROSSEL","VARIAÇÕES"];
function FormatTicker(){return <div className="fb-ticker" aria-label="Formatos criativos"><div>{[...formats,...formats].map((item,index)=><span key={`${item}-${index}`}>{item}<i/></span>)}</div></div>}

const discoverySteps=[
  {n:"01",tag:"DESCOBERTA",title:"Entendemos as dores reais",body:"Ouvimos quem vive a operação para descobrir onde a criação trava, quanto isso custa e por que continua acontecendo."},
  {n:"02",tag:"DIREÇÃO",title:"Transformamos dor em caminho",body:"Os padrões encontrados mostram o que vale construir primeiro e quais mudanças fariam diferença na rotina."},
  {n:"03",tag:"VALIDAÇÃO",title:"Testamos com operações reais",body:"A primeira versão nasce pequena, aprende com o uso e evolui junto com as marcas que ajudaram a construí-la."},
];
function DiscoveryProcess(){return <section id="como-funciona" className="fb-process"><div className="fb-section-head"><span>COMO FUNCIONA</span><h2>Antes do produto,<br/>vêm as <em>dores reais.</em></h2><p>Uma solução útil não começa por funcionalidades. Começa entendendo o trabalho, os gargalos e o resultado que as pessoas precisam.</p></div><div className="fb-step-list">{discoverySteps.map(step=><article key={step.n}><div><span>{step.n}</span><small>{step.tag}</small></div><h3>{step.title}</h3><p>{step.body}</p><i/></article>)}</div></section>}

function ResearchInvite({onJoin}){return <section className="fb-invite"><div><span>PESQUISA DE DESCOBERTA</span><h2>Queremos construir a partir da sua realidade, <em>não de suposições.</em></h2></div><SoftButton light onClick={onJoin}>Quero participar da construção <ArrowRight size={15}/></SoftButton></section>}

const faqs=[
  ["O que o CreatvOS quer resolver?","Queremos ajudar marcas e ecommerces que precisam produzir mais ideias e variações para mídia paga sem aumentar a demora, o custo e a sobrecarga do time."],
  ["Por que fazer uma pesquisa antes de construir?","Porque não queremos adivinhar o problema. Queremos entender onde a criação trava, o impacto desse gargalo e o que realmente precisa mudar."],
  ["O produto já está disponível?","Ainda não. Estamos na fase de descoberta e as respostas da pesquisa vão orientar o que será construído primeiro."],
  ["Quem deveria participar?","Fundadores, pessoas de marketing, tráfego e criação que convivem com a necessidade de produzir campanhas com frequência."],
  ["O que acontece depois da pesquisa?","Vamos reunir os padrões mais importantes, definir a primeira experiência e convidar algumas operações para testar conosco."],
];
function FAQ(){const[active,setActive]=useState(0);return <section id="faq" className="fb-faq"><div className="fb-section-head"><span>PERGUNTAS FREQUENTES</span><h2>Antes de colocar<br/>a máquina para <em>rodar.</em></h2><p>A pesquisa explica o momento atual e abre espaço para você contar o seu cenário.</p></div><div className="fb-faq-list">{faqs.map(([question,answer],index)=><article key={question}><button onClick={()=>setActive(active===index?-1:index)} aria-expanded={active===index}><span>{String(index+1).padStart(2,"0")}</span><b>{question}</b><i>{active===index?"−":"+"}</i></button>{active===index&&<p>{answer}</p>}</article>)}</div></section>}

function LandingFooter({onJoin}){return <footer className="fb-footer"><img src={logo} alt="CreatvOS"/><h2>Uma solução brasileira.<br/>Criada com quem vive<br/><em>o ecommerce.</em></h2><SoftButton light onClick={onJoin}>Participar da pesquisa <ArrowRight size={15}/></SoftButton><div><span>© {new Date().getFullYear()} CreatvOS</span><span>Construindo a partir de dores reais.</span><a href="#inicio">Voltar ao topo ↑</a></div></footer>}

const researchQuestions = [
  "O que os clientes realmente valorizam nesta categoria?",
  "Quais promessas já perderam força?",
  "Que linguagem aparece nas avaliações cinco estrelas?",
  "Onde os concorrentes estão todos dizendo a mesma coisa?",
  "Quais tensões ainda não viraram uma boa campanha?",
  "O que faz alguém parar, acreditar e comprar?",
  "Que comportamento mudou nos últimos meses?",
  "Quais ângulos merecem virar hipóteses criativas?",
  "O que os anúncios vencedores têm em comum?",
];

function Proposal({ onJoin }) {
  return <section id="proposta" className="proposal product-summary"><div className="section-label"><span>O PRODUTO</span><span>DO CATÁLOGO À CAMPANHA</span></div><div className="proposal-head"><h2>Uma operação criativa<br/><em>para o seu catálogo.</em></h2><p>Escolha um produto, adicione a oferta e gere diferentes caminhos de campanha. O CreatvOS organiza a produção para sua marca testar mais sem começar do zero.</p></div><div className="product-showcase"><img className="showcase-city" src={cityBridge} alt="São Paulo"/><div className="showcase-shade"/></div></section>;
}

const steps = [
  { n:"01", title:"Comece pelo que você vende", body:"Produtos, ofertas, referências e o jeito da marca formam a matéria-prima.", tag:"PRODUTO", words:["produto","oferta","marca"] },
  { n:"02", title:"Abra novas abordagens", body:"Benefício, prova, desejo e contexto viram caminhos diferentes para a mesma oferta.", tag:"DIREÇÃO", words:["benefício","prova","desejo"] },
  { n:"03", title:"Coloque mais ideias no ar", body:"Cada caminho se desdobra em formatos e variações prontos para sua operação testar.", tag:"TESTE", words:["vídeo","estático","hook"] },
];

function StepArt({ type }) {
  if(type==="radar") return <div className="step-art radar-art"><i/><i/><i/><span/><b>mercado</b><b>cultura</b><b>cliente</b></div>;
  if(type==="signals") return <div className="step-art signal-art"><span>“funciona na rotina”</span><span>“quero confiar”</span><span>“sem complicação”</span><i/><i/><i/></div>;
  return <div className="step-art direction-art"><span>01<small>PROVA</small></span><span>02<small>DESEJO</small></span><span>03<small>CONTRASTE</small></span><i>→</i></div>;
}

function HowItWorks() {
  return <section id="como-funciona" className="how"><div className="how-head"><span>COMO FUNCIONA</span><h2>Do produto<br/>para muitos <em>testes.</em></h2><p>Uma operação simples para transformar o que você já vende em novas possibilidades de campanha.</p></div><div className="step-grid simple-steps">{steps.map((step)=><article key={step.n}><div className="step-top"><span>{step.n}</span><span>{step.tag}</span></div><div className="word-stack">{step.words.map(word=><span key={word}>{word}</span>)}</div><div className="step-copy"><h3>{step.title}</h3><p>{step.body}</p></div></article>)}</div></section>;
}

const features = [
  { title:"Mais ideias por produto", body:"Uma mesma oferta pode ganhar novos ângulos, mensagens e formatos sem começar do zero.", note:"VOLUME" },
  { title:"A marca continua sendo sua", body:"Cores, linguagem e referências orientam cada peça para manter tudo reconhecível.", note:"CONSISTÊNCIA" },
  { title:"Feito para mídia paga", body:"As variações nascem pensando em formatos, atenção e aprendizado de campanha.", note:"PERFORMANCE" },
  { title:"Aprenda a cada rodada", body:"O que funciona ajuda a decidir quais caminhos merecem novas variações.", note:"EVOLUÇÃO" },
];

function FeatureArt({ type }) {
  if(type==="brand") return <div className="brand-art"><span>CREATVOS</span><i/><i/><i/><small>O JEITO DA MARCA · CLARO</small></div>;
  if(type==="bars") return <div className="bars-art">{Array.from({length:34},(_,i)=><i key={i} style={{"--h":`${20+(i*17)%76}%`}}/> )}</div>;
  if(type==="remix") return <div className="remix-art"><span>IDEIA</span><ArrowRight/><span>08</span><small>NOVOS CAMINHOS</small></div>;
  return <div className="loop-art"><i/><i/><i/><span>OUVIR<br/>CRIAR<br/>APRENDER</span></div>;
}

function Capabilities() {
  return <section id="capacidades" className="capabilities"><div className="cap-head"><span>O QUE MUDA</span><h2>Mais variedade.<br/>Sem transformar sua marca <em>em template.</em></h2></div><div className="feature-grid editorial-features">{features.map((feature,index)=><article key={feature.title}><div className="feature-meta"><span>{String(index+1).padStart(2,"0")}</span><small>{feature.note}</small></div><div><h3>{feature.title}</h3><p>{feature.body}</p></div></article>)}</div></section>;
}

function Manifesto() {
  return <section className="manifesto"><span>O QUE ESTAMOS CONSTRUINDO</span><h2>Seu catálogo não deveria<br/>ficar sem novas <em>ideias.</em></h2><div className="manifesto-bottom"><p>Mais produtos em campanha.<br/>Mais abordagens para testar.<br/>Mais consistência em cada peça.</p><div><Layers3/><span>Produtos no centro</span></div><div><WandSparkles/><span>Variações com identidade</span></div><div><Zap/><span>Aprendizado contínuo</span></div></div></section>;
}

function Waitlist({ onJoin }) {
  return <section id="waitlist" className="waitlist"><div className="waitlist-wave">{Array.from({length:11},(_,i)=><i key={i}/>)}</div><div className="waitlist-copy"><span>QUEREMOS OUVIR VOCÊ</span><h2>Uma solução brasileira<br/>começa com quem <em>faz.</em></h2><p>Conte um pouco da sua rotina e ajude a construir o CreatvOS.</p><SoftButton light onClick={onJoin}>Participar da pesquisa <ArrowRight size={15}/></SoftButton></div></section>;
}

function Footer(){return <footer><img src={logo} alt="CreatvOS"/><nav><a href="#proposta">A ideia</a><a href="#como-funciona">Como pensamos</a><a href="#capacidades">O que muda</a></nav><span>© {new Date().getFullYear()} CreatvOS · Brasil</span></footer>}

const diagnosisSteps=[
  {key:"nome",label:"Apresentação",question:"Pra começar, como podemos te chamar?",helper:"São só quatro dados rápidos antes de entendermos sua operação.",placeholder:"Seu primeiro nome",type:"text"},
  {key:"marca",label:"Empresa",question:"Qual é o nome da sua empresa ou marca?",helper:"Pode ser o nome comercial ou como vocês se apresentam no mercado.",placeholder:"Nome da empresa ou marca",type:"text"},
  {key:"telefone",label:"Telefone",question:"Qual é o melhor telefone para falar com você?",helper:"Inclua o DDD. Usaremos apenas para assuntos relacionados à pesquisa.",placeholder:"(00) 00000-0000",type:"tel"},
  {key:"email",label:"E-mail",question:"E qual é o seu melhor e-mail?",helper:"Assim conseguimos manter você por perto durante a construção.",placeholder:"voce@empresa.com",type:"email"},
  {key:"papel",label:"Seu papel",question:"Qual é o seu papel na operação hoje?",helper:"Queremos entender de qual cadeira você enxerga esse problema.",options:["Fundador ou sócio","Marketing ou growth","Mídia paga","Criação ou design","Atendimento ou estratégia","Outro"]},
  {key:"operacao",label:"Operação",question:"Que tipo de negócio você ajuda a crescer?",helper:"Não estamos assumindo que essa necessidade existe apenas no ecommerce.",options:["Ecommerce","Marca de consumo","Agência","Serviço ou negócio local","Infoproduto ou educação","SaaS ou aplicativo","Outro"]},
  {key:"midia",label:"Investimento atual",question:"Quanto a operação investe por mês em mídia paga?",helper:"Uma faixa aproximada já ajuda a dimensionar o momento da operação.",options:["Ainda não investe","Até R$ 5 mil","R$ 5 mil a R$ 20 mil","R$ 20 mil a R$ 50 mil","R$ 50 mil a R$ 100 mil","Mais de R$ 100 mil"]},
  {key:"processo",label:"Processo atual",question:"Quem produz os anúncios hoje?",helper:"Queremos entender como o trabalho acontece antes de pensar em uma solução.",options:["Time interno","Agência","Freelancers","Eu mesmo","Uma combinação desses formatos"]},
  {key:"volume",label:"Volume",question:"Quantos anúncios novos entram no ar por mês?",helper:"Considere peças, vídeos e variações realmente publicadas.",options:["Até 10","11 a 30","31 a 60","61 a 100","Mais de 100"]},
  {key:"dores",label:"Gargalos",question:"Onde a produção criativa mais dói hoje?",helper:"Marque tudo que fizer parte da sua realidade.",multiple:true,options:["Falta de volume","Produção muito lenta","Pouca variedade de ideias","Aprovação vira gargalo","Custo por peça alto","Difícil manter a marca"]},
  {key:"impacto",label:"Impacto",question:"Qual é o principal efeito disso na operação?",helper:"Escolha o impacto que mais pesa nas decisões de hoje.",options:["Testamos menos do que gostaríamos","Os anúncios cansam rápido","As campanhas atrasam","O time vive sobrecarregado","O crescimento fica travado"]},
  {key:"canais",label:"Canais",question:"Onde esses anúncios costumam rodar?",helper:"Marque todos os canais que fazem parte da sua rotina.",multiple:true,options:["Meta Ads","Google Ads","TikTok Ads","LinkedIn Ads","Marketplaces","Outros canais"]},
  {key:"prioridades",label:"Solução ideal",question:"O que uma solução precisaria fazer para valer sua atenção?",helper:"Escolha os resultados que realmente mudariam sua rotina.",multiple:true,options:["Gerar ideias melhores","Criar variações em escala","Manter a identidade da marca","Produzir imagens e vídeos","Acelerar aprovações","Aprender com resultados"]},
  {key:"investimento",label:"Disposição de investimento",question:"Se resolvesse bem esse gargalo, quanto faria sentido investir por mês?",helper:"Não é uma oferta. Queremos entender o valor percebido de uma solução útil.",options:["Até R$ 200","R$ 201 a R$ 500","R$ 501 a R$ 1 mil","R$ 1 mil a R$ 2,5 mil","Mais de R$ 2,5 mil","Depende do resultado"]},
  {key:"piloto",label:"Primeiros testes",question:"Você toparia testar uma primeira versão conosco?",helper:"Os primeiros testes serão pequenos e próximos de quem vive o problema.",options:["Sim, quero participar","Talvez, quero entender melhor","Prefiro apenas acompanhar"]},
  {key:"contexto",label:"Contexto",question:"Se pudesse destravar uma coisa agora, o que mudaria?",helper:"Conte com suas palavras. Quanto mais concreto, melhor conseguimos entender.",long:true},
];

function ResearchPage(){const[step,setStep]=useState(0);const[sent,setSent]=useState(false);const[answers,setAnswers]=useState({nome:"",operacao:"",marca:"",dores:[],impacto:"",volume:"",contexto:"",email:"",whatsapp:""});const current=diagnosisSteps[step];const update=(key,value)=>setAnswers({...answers,[key]:value});const toggle=(option)=>update("dores",answers.dores.includes(option)?answers.dores.filter(item=>item!==option):[...answers.dores,option]);const canContinue=()=>current.key==="dores"?answers.dores.length>0:current.contact?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email):String(answers[current.key]||"").trim().length>0;const next=(event)=>{event.preventDefault();if(!canContinue())return;if(step===diagnosisSteps.length-1)setSent(true);else setStep(step+1)};const summary=(item)=>{const value=answers[item.key];if(Array.isArray(value))return value.join(" · ");return value};return <main className="diagnosis-page"><header className="diagnosis-header"><a href="/"><img src={logo} alt="CreatvOS"/></a><span>{sent?"NA LISTA":`${String(step+1).padStart(2,"0")} / ${String(diagnosisSteps.length).padStart(2,"0")}`}</span><a href="/" aria-label="Voltar ao site"><X/></a></header>{sent?<section className="diagnosis-success"><span><Check/></span><small>RESPOSTA RECEBIDA</small><h1>Obrigado, {answers.nome}.<br/>Sua experiência agora faz parte da construção.</h1><p>Vamos considerar o cenário da {answers.marca} ao definir o produto. Avisaremos quando os primeiros testes forem abertos.</p><a href="/">Voltar para a página</a></section>:<div className="diagnosis-layout"><aside className="diagnosis-rail"><div><span>PESQUISA CREATVOS</span><h2>Antes de construir,<br/>queremos ouvir.</h2><p>8 perguntas sobre a realidade da sua operação.</p></div><div className="diagnosis-summary">{diagnosisSteps.slice(0,step).map(item=><div key={item.key}><span>{item.label}</span><p>{summary(item)}</p></div>)}</div><div className="diagnosis-wave">{Array.from({length:9},(_,index)=><i key={index}/>)}</div></aside><form className="diagnosis-stage" onSubmit={next}><div className="diagnosis-progress"><i style={{width:`${((step+1)/diagnosisSteps.length)*100}%`}}/></div><div className="diagnosis-copy" key={current.key}><span>{current.label}</span><h1>{current.question}</h1><p>{current.helper}</p></div><div className="diagnosis-answer">{current.options&&<div className="diagnosis-choices">{current.options.map(option=>{const selected=current.multiple?answers.dores.includes(option):answers[current.key]===option;return <button type="button" key={option} className={selected?"selected":""} onClick={()=>current.multiple?toggle(option):update(current.key,option)}><span>{option}</span><i>{selected?<Check/>:<ArrowRight/>}</i></button>})}</div>}{!current.options&&!current.contact&&<label>{current.long?<textarea autoFocus rows="4" value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder="Escreva do seu jeito..."/>:<input autoFocus value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder={current.key==="nome"?"Seu primeiro nome":"Nome da marca ou operação"}/>}</label>}{current.contact&&<div className="diagnosis-contact"><label>E-mail profissional<input autoFocus type="email" value={answers.email} onChange={event=>update("email",event.target.value)} placeholder="voce@empresa.com"/></label><label>WhatsApp <small>opcional</small><input type="tel" value={answers.whatsapp} onChange={event=>update("whatsapp",event.target.value)} placeholder="(00) 00000-0000"/></label></div>}</div><div className="diagnosis-actions"><button type="button" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}><ArrowLeft/> Voltar</button><button type="submit" disabled={!canContinue()}>{step===diagnosisSteps.length-1?"Enviar respostas":"Continuar"}<ArrowRight/></button></div></form></div>}</main>}

function ConversationalResearchPage(){
  const [step,setStep]=useState(0);
  const [sent,setSent]=useState(false);
  const [answers,setAnswers]=useState({nome:"",marca:"",telefone:"",email:"",papel:"",operacao:"",midia:"",processo:"",volume:"",dores:[],impacto:"",canais:[],prioridades:[],investimento:"",piloto:"",contexto:""});
  const current=diagnosisSteps[step];
  const update=(key,value)=>setAnswers(previous=>({...previous,[key]:value}));
  const toggle=(option)=>{const selected=answers[current.key]||[];update(current.key,selected.includes(option)?selected.filter(item=>item!==option):[...selected,option])};
  const canContinue=()=>current.multiple?(answers[current.key]||[]).length>0:current.key==="email"?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email):String(answers[current.key]||"").trim().length>0;
  const next=(event)=>{event.preventDefault();if(!canContinue())return;if(step===diagnosisSteps.length-1)setSent(true);else setStep(value=>value+1)};
  return <main className="conversation-page">
    <header className="conversation-header">
      <div className="conversation-progress"><i style={{width:`${sent?100:((step+1)/diagnosisSteps.length)*100}%`}}/></div>
      <a href="/"><img src={logo} alt="CreatvOS"/></a>
      <span>{sent?"RESPOSTA RECEBIDA":`${String(step+1).padStart(2,"0")} / ${String(diagnosisSteps.length).padStart(2,"0")}`}</span>
      <a className="conversation-exit" href="/" aria-label="Voltar ao site"><X/></a>
    </header>
    {sent?<section className="conversation-success"><span><Check/></span><h1>Obrigado, {answers.nome}.<br/>Vamos construir isso <em>com quem vive a operação.</em></h1><p>Sua experiência agora faz parte da direção do CreatvOS. Avisaremos quando os primeiros testes estiverem prontos.</p><a href="/">Voltar para a página <ArrowRight/></a></section>:
    <section className="conversation-question" key={current.key}>
      <div className="question-number"><MessageCircle/>{current.label}</div>
      <h1>{current.question}</h1>
      <p>{current.helper}</p>
      <form onSubmit={next}>
        {current.options&&<div className="choice-list">{current.options.map((option,index)=>{const selected=current.multiple?(answers[current.key]||[]).includes(option):answers[current.key]===option;return <button type="button" key={option} className={selected?"selected":""} onClick={()=>current.multiple?toggle(option):update(current.key,option)}><kbd>{String.fromCharCode(65+index)}</kbd><span>{option}</span><Check/></button>})}</div>}
        {!current.options&&(current.long?<textarea autoFocus value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder="Escreva do seu jeito..."/>:<input autoFocus type={current.type||"text"} value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder={current.placeholder||"Escreva aqui"}/>) }
        <div className="conversation-actions">
          {step>0&&<button className="question-back" type="button" onClick={()=>setStep(value=>value-1)}><ArrowLeft/> Voltar</button>}
          <button className="question-next" type="submit" disabled={!canContinue()}>{step===diagnosisSteps.length-1?"Enviar respostas":"Continuar"}<ArrowRight/></button>
          <small>pressione Enter ↵</small>
        </div>
      </form>
    </section>}
    {!sent&&<div className="conversation-foot">PESQUISA DE DESCOBERTA · CREATVOS</div>}
  </main>
}

function App(){const join=()=>window.location.assign("/pesquisa");return <><Header onJoin={join}/><Hero onJoin={join}/></>}
const page=window.location.pathname.replace(/\/$/,"");
createRoot(document.getElementById("root")).render(<StrictMode>{page==="/pesquisa"?<ConversationalResearchPage/>:<App/>}</StrictMode>);
