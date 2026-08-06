import React, { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Download, Eye, Inbox, Layers3, LockKeyhole, LogOut, Menu, MessageCircle, Play, Plus, RefreshCw, Search, WandSparkles, X, Zap } from "lucide-react";
import logo from "./assets/logo.svg?url";
import cityBridge from "./assets/hero-city.png";
import tag from "./assets/TAG.svg?url";
import { supabase } from "./lib/supabase";
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
  {key:"site",label:"Presença digital",question:"Onde podemos conhecer melhor a empresa?",helper:"Pode ser o site, Instagram ou perfil que melhor representa a marca.",placeholder:"seusite.com.br ou @suamarca",type:"text"},
  {key:"papel",label:"Seu papel",question:"Qual é o seu papel na operação hoje?",helper:"Queremos entender de qual cadeira você enxerga esse problema.",options:["Fundador ou sócio","Marketing ou growth","Mídia paga","Criação ou design","Atendimento ou estratégia","Outro"]},
  {key:"decisao",label:"Decisão",question:"Qual é a sua participação na escolha de novas ferramentas?",helper:"Isso nos ajuda a entender como uma solução entra na operação.",options:["Eu decido","Decido com outras pessoas","Eu recomendo","Eu usaria, mas não decido","Ainda não sei"]},
  {key:"operacao",label:"Operação",question:"Que tipo de negócio você ajuda a crescer?",helper:"Não estamos assumindo que essa necessidade existe apenas no ecommerce.",options:["Ecommerce","Marca de consumo","Agência","Serviço ou negócio local","Infoproduto ou educação","SaaS ou aplicativo","Outro"]},
  {key:"publico",label:"Cliente",question:"Para quem a empresa vende principalmente?",helper:"Escolha o modelo que mais representa a receita hoje.",options:["Consumidor final","Outras empresas","Consumidor e empresas","A empresa ainda está validando"]},
  {key:"equipe",label:"Tamanho da equipe",question:"Quantas pessoas trabalham na operação?",helper:"Considere pessoas internas e sócios que participam no dia a dia.",options:["Só eu","2 a 5","6 a 15","16 a 50","Mais de 50"]},
  {key:"faturamento",label:"Momento do negócio",question:"Qual é a faixa de faturamento mensal da empresa?",helper:"A resposta é confidencial e ajuda a relacionar necessidade com capacidade de investimento.",options:["Ainda sem faturamento","Até R$ 50 mil","R$ 50 mil a R$ 200 mil","R$ 200 mil a R$ 500 mil","R$ 500 mil a R$ 1 milhão","Mais de R$ 1 milhão","Prefiro não informar"]},
  {key:"catalogo",label:"Catálogo",question:"Quantos produtos ou ofertas precisam de anúncios?",helper:"Considere o catálogo ativo ou as ofertas promovidas com frequência.",options:["1 a 5","6 a 20","21 a 50","51 a 200","Mais de 200","Não trabalhamos com catálogo"]},
  {key:"ticket",label:"Ticket médio",question:"Qual é o ticket médio das vendas?",helper:"Uma faixa aproximada já é suficiente.",options:["Até R$ 100","R$ 101 a R$ 300","R$ 301 a R$ 1 mil","R$ 1 mil a R$ 5 mil","Mais de R$ 5 mil","Varia muito"]},
  {key:"midia",label:"Investimento atual",question:"Quanto a operação investe por mês em mídia paga?",helper:"Uma faixa aproximada já ajuda a dimensionar o momento da operação.",options:["Ainda não investe","Até R$ 5 mil","R$ 5 mil a R$ 20 mil","R$ 20 mil a R$ 50 mil","R$ 50 mil a R$ 100 mil","Mais de R$ 100 mil"]},
  {key:"canais",label:"Canais",question:"Onde esses anúncios costumam rodar?",helper:"Marque todos os canais que fazem parte da sua rotina.",multiple:true,options:["Meta Ads","Google Ads","TikTok Ads","LinkedIn Ads","Marketplaces","Outros canais"]},
  {key:"processo",label:"Processo atual",question:"Quem produz os anúncios hoje?",helper:"Queremos entender como o trabalho acontece antes de pensar em uma solução.",options:["Time interno","Agência","Freelancers","Eu mesmo","Uma combinação desses formatos"]},
  {key:"ferramentas",label:"Ferramentas",question:"O que vocês usam para produzir anúncios hoje?",helper:"Marque todas as ferramentas e caminhos que fazem parte do processo.",multiple:true,options:["Canva","Adobe","CapCut","Ferramentas de IA","Plataforma da agência","Nenhuma ferramenta fixa","Outras"]},
  {key:"volume",label:"Volume",question:"Quantos anúncios novos entram no ar por mês?",helper:"Considere peças, vídeos e variações realmente publicadas.",options:["Até 10","11 a 30","31 a 60","61 a 100","Mais de 100"]},
  {key:"formatos",label:"Formatos",question:"Quais formatos mais fazem falta na operação?",helper:"Marque tudo que vocês gostariam de produzir com mais frequência.",multiple:true,options:["Imagens estáticas","Vídeos curtos","UGC","Carrosséis","Variações de copy","Hooks e roteiros","Peças para catálogo"]},
  {key:"prazo",label:"Tempo de produção",question:"Quanto tempo leva para um anúncio sair da ideia e entrar no ar?",helper:"Considere o ciclo normal, incluindo criação e aprovação.",options:["No mesmo dia","1 a 3 dias","4 a 7 dias","1 a 2 semanas","Mais de 2 semanas"]},
  {key:"custoCriativo",label:"Custo criativo",question:"Quanto a empresa gasta por mês com produção criativa?",helper:"Inclua equipe, agência, freelancers e ferramentas quando fizer sentido.",options:["Até R$ 1 mil","R$ 1 mil a R$ 5 mil","R$ 5 mil a R$ 15 mil","R$ 15 mil a R$ 50 mil","Mais de R$ 50 mil","Não sabemos hoje"]},
  {key:"dores",label:"Gargalos",question:"Onde a produção criativa mais dói hoje?",helper:"Marque tudo que fizer parte da sua realidade.",multiple:true,options:["Falta de volume","Produção muito lenta","Pouca variedade de ideias","Aprovação vira gargalo","Custo por peça alto","Difícil manter a marca"]},
  {key:"impacto",label:"Impacto",question:"Qual é o principal efeito disso na operação?",helper:"Escolha o impacto que mais pesa nas decisões de hoje.",options:["Testamos menos do que gostaríamos","Os anúncios cansam rápido","As campanhas atrasam","O time vive sobrecarregado","O crescimento fica travado"]},
  {key:"prioridade",label:"Prioridade",question:"Qual resultado seria mais importante nos próximos 90 dias?",helper:"Escolha o que faria a maior diferença agora.",options:["Aumentar o volume de testes","Reduzir o custo de produção","Encontrar ideias melhores","Lançar campanhas mais rápido","Manter mais consistência","Melhorar a performance"]},
  {key:"prioridades",label:"Solução ideal",question:"O que uma solução precisaria fazer para valer sua atenção?",helper:"Escolha os resultados que realmente mudariam sua rotina.",multiple:true,options:["Gerar ideias melhores","Criar variações em escala","Manter a identidade da marca","Produzir imagens e vídeos","Acelerar aprovações","Aprender com resultados"]},
  {key:"investimento",label:"Disposição de investimento",question:"Se resolvesse bem esse gargalo, quanto faria sentido investir por mês?",helper:"Não é uma oferta. Queremos entender o valor percebido de uma solução útil.",options:["Até R$ 200","R$ 201 a R$ 500","R$ 501 a R$ 1 mil","R$ 1 mil a R$ 2,5 mil","Mais de R$ 2,5 mil","Depende do resultado"]},
  {key:"urgencia",label:"Urgência",question:"Quando faria sentido começar a resolver esse problema?",helper:"Isso nos ajuda a separar curiosidade de uma necessidade ativa.",options:["Agora","Nos próximos 30 dias","Neste trimestre","Mais para frente","Estou apenas pesquisando"]},
  {key:"piloto",label:"Primeiros testes",question:"Você toparia testar uma primeira versão conosco?",helper:"Os primeiros testes serão pequenos e próximos de quem vive o problema.",options:["Sim, quero participar","Talvez, quero entender melhor","Prefiro apenas acompanhar"]},
  {key:"contexto",label:"Contexto",question:"Se pudesse destravar uma coisa agora, o que mudaria?",helper:"Conte com suas palavras. Quanto mais concreto, melhor conseguimos entender.",long:true},
  {key:"consentimento",label:"Privacidade",question:"Podemos guardar suas respostas e entrar em contato sobre o CreatvOS?",helper:"Seus dados serão usados somente para esta pesquisa e para os primeiros testes do produto.",options:["Sim, concordo"]},
];

function formatBrazilPhone(value){
  const digits=value.replace(/\D/g,"").slice(0,11);
  if(!digits)return "";
  if(digits.length<3)return `(${digits}`;
  if(digits.length<7)return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if(digits.length<11)return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

async function persistResearch(response){
  const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
  const publishableKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!supabaseUrl||!publishableKey)throw new Error("Supabase não configurado");
  const request=await fetch(`${supabaseUrl}/rest/v1/research_responses`,{
    method:"POST",
    headers:{
      apikey:publishableKey,
      "Content-Type":"application/json",
      Prefer:"return=minimal",
    },
    body:JSON.stringify({
      id:response.id,
      nome:response.nome,
      empresa:response.marca,
      telefone:response.telefone,
      email:response.email,
      origem:window.location.hostname,
      respostas:response,
    }),
  });
  if(!request.ok){const details=await request.text();throw new Error(details||"Não foi possível enviar a pesquisa")}
}

function ResearchPage(){const[step,setStep]=useState(0);const[sent,setSent]=useState(false);const[answers,setAnswers]=useState({nome:"",operacao:"",marca:"",dores:[],impacto:"",volume:"",contexto:"",email:"",whatsapp:""});const current=diagnosisSteps[step];const update=(key,value)=>setAnswers({...answers,[key]:value});const toggle=(option)=>update("dores",answers.dores.includes(option)?answers.dores.filter(item=>item!==option):[...answers.dores,option]);const canContinue=()=>current.key==="dores"?answers.dores.length>0:current.contact?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email):String(answers[current.key]||"").trim().length>0;const next=(event)=>{event.preventDefault();if(!canContinue())return;if(step===diagnosisSteps.length-1)setSent(true);else setStep(step+1)};const summary=(item)=>{const value=answers[item.key];if(Array.isArray(value))return value.join(" · ");return value};return <main className="diagnosis-page"><header className="diagnosis-header"><a href="/"><img src={logo} alt="CreatvOS"/></a><span>{sent?"NA LISTA":`${String(step+1).padStart(2,"0")} / ${String(diagnosisSteps.length).padStart(2,"0")}`}</span><a href="/" aria-label="Voltar ao site"><X/></a></header>{sent?<section className="diagnosis-success"><span><Check/></span><small>RESPOSTA RECEBIDA</small><h1>Obrigado, {answers.nome}.<br/>Sua experiência agora faz parte da construção.</h1><p>Vamos considerar o cenário da {answers.marca} ao definir o produto. Avisaremos quando os primeiros testes forem abertos.</p><a href="/">Voltar para a página</a></section>:<div className="diagnosis-layout"><aside className="diagnosis-rail"><div><span>PESQUISA CREATVOS</span><h2>Antes de construir,<br/>queremos ouvir.</h2><p>8 perguntas sobre a realidade da sua operação.</p></div><div className="diagnosis-summary">{diagnosisSteps.slice(0,step).map(item=><div key={item.key}><span>{item.label}</span><p>{summary(item)}</p></div>)}</div><div className="diagnosis-wave">{Array.from({length:9},(_,index)=><i key={index}/>)}</div></aside><form className="diagnosis-stage" onSubmit={next}><div className="diagnosis-progress"><i style={{width:`${((step+1)/diagnosisSteps.length)*100}%`}}/></div><div className="diagnosis-copy" key={current.key}><span>{current.label}</span><h1>{current.question}</h1><p>{current.helper}</p></div><div className="diagnosis-answer">{current.options&&<div className="diagnosis-choices">{current.options.map(option=>{const selected=current.multiple?answers.dores.includes(option):answers[current.key]===option;return <button type="button" key={option} className={selected?"selected":""} onClick={()=>current.multiple?toggle(option):update(current.key,option)}><span>{option}</span><i>{selected?<Check/>:<ArrowRight/>}</i></button>})}</div>}{!current.options&&!current.contact&&<label>{current.long?<textarea autoFocus rows="4" value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder="Escreva do seu jeito..."/>:<input autoFocus value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder={current.key==="nome"?"Seu primeiro nome":"Nome da marca ou operação"}/>}</label>}{current.contact&&<div className="diagnosis-contact"><label>E-mail profissional<input autoFocus type="email" value={answers.email} onChange={event=>update("email",event.target.value)} placeholder="voce@empresa.com"/></label><label>WhatsApp <small>opcional</small><input type="tel" value={answers.whatsapp} onChange={event=>update("whatsapp",event.target.value)} placeholder="(00) 00000-0000"/></label></div>}</div><div className="diagnosis-actions"><button type="button" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}><ArrowLeft/> Voltar</button><button type="submit" disabled={!canContinue()}>{step===diagnosisSteps.length-1?"Enviar respostas":"Continuar"}<ArrowRight/></button></div></form></div>}</main>}

function ConversationalResearchPage(){
  const [step,setStep]=useState(0);
  const [sent,setSent]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const [responseId]=useState(()=>crypto.randomUUID());
  const [answers,setAnswers]=useState({nome:"",marca:"",telefone:"",email:"",site:"",papel:"",decisao:"",operacao:"",publico:"",equipe:"",faturamento:"",catalogo:"",ticket:"",midia:"",canais:[],processo:"",ferramentas:[],volume:"",formatos:[],prazo:"",custoCriativo:"",dores:[],impacto:"",prioridade:"",prioridades:[],investimento:"",urgencia:"",piloto:"",contexto:"",consentimento:""});
  const current=diagnosisSteps[step];
  const update=(key,value)=>setAnswers(previous=>({...previous,[key]:value}));
  const toggle=(option)=>{const selected=answers[current.key]||[];update(current.key,selected.includes(option)?selected.filter(item=>item!==option):[...selected,option])};
  const canContinue=()=>current.multiple?(answers[current.key]||[]).length>0:current.key==="email"?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email):current.key==="telefone"?answers.telefone.replace(/\D/g,"").length>=10:String(answers[current.key]||"").trim().length>0;
  const next=async(event)=>{event.preventDefault();if(!canContinue()||submitting)return;if(step===diagnosisSteps.length-1){const response={...answers,id:responseId,respondidoEm:new Date().toISOString()};setSubmitting(true);setSubmitError("");try{await persistResearch(response);localStorage.removeItem("creatvos_research_pending");setSent(true)}catch(error){localStorage.setItem("creatvos_research_pending",JSON.stringify(response));setSubmitError("Não conseguimos enviar agora. Confira sua conexão e tente novamente.")}finally{setSubmitting(false)}}else setStep(value=>value+1)};
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
        {!current.options&&(current.long?<textarea autoFocus value={answers[current.key]} onChange={event=>update(current.key,event.target.value)} placeholder="Escreva do seu jeito..."/>:<input autoFocus type={current.type||"text"} inputMode={current.type==="tel"?"numeric":undefined} value={answers[current.key]} onChange={event=>update(current.key,current.key==="telefone"?formatBrazilPhone(event.target.value):event.target.value)} placeholder={current.placeholder||"Escreva aqui"}/>) }
        <div className="conversation-actions">
          {step>0&&<button className="question-back" type="button" onClick={()=>setStep(value=>value-1)}><ArrowLeft/> Voltar</button>}
          <button className="question-next" type="submit" disabled={!canContinue()||submitting}>{submitting?"Enviando...":step===diagnosisSteps.length-1?"Enviar respostas":"Continuar"}<ArrowRight/></button>
          <small>pressione Enter ↵</small>
        </div>
        {submitError&&<p className="conversation-error" role="alert">{submitError}</p>}
      </form>
    </section>}
    {!sent&&<div className="conversation-foot">PESQUISA DE DESCOBERTA · CREATVOS</div>}
  </main>
}

const ADMIN_EMAIL="pedropaulinettid@gmail.com";
const answerLabels=Object.fromEntries(diagnosisSteps.map(item=>[item.key,item.label]));

function csvValue(value){
  const text=Array.isArray(value)?value.join("; "):String(value??"");
  return `"${text.replaceAll('"','""')}"`;
}

function AdminPortal(){
  const[session,setSession]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[loginSent,setLoginSent]=useState(false);
  const[loginError,setLoginError]=useState("");
  const[responses,setResponses]=useState([]);
  const[loading,setLoading]=useState(false);
  const[dataError,setDataError]=useState("");
  const[query,setQuery]=useState("");
  const[pilotFilter,setPilotFilter]=useState("todos");
  const[selected,setSelected]=useState(null);

  useEffect(()=>{
    if(!supabase){setAuthReady(true);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true)});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setAuthReady(true)});
    return()=>subscription.unsubscribe();
  },[]);

  const authorized=session?.user?.email?.toLowerCase()===ADMIN_EMAIL;
  const loadResponses=async()=>{
    if(!authorized||!supabase)return;
    setLoading(true);setDataError("");
    const{data,error}=await supabase.from("research_responses").select("*").order("created_at",{ascending:false});
    if(error)setDataError("Não foi possível carregar as respostas. Confira se a regra de acesso do portal foi aplicada no Supabase.");
    else setResponses(data||[]);
    setLoading(false);
  };

  useEffect(()=>{if(authorized)loadResponses()},[authorized]);

  const filtered=useMemo(()=>responses.filter(item=>{
    const term=query.trim().toLowerCase();
    const matchesSearch=!term||[item.nome,item.empresa,item.email,item.telefone].some(value=>String(value||"").toLowerCase().includes(term));
    const wantsPilot=item.respostas?.piloto==="Sim, quero participar";
    const matchesPilot=pilotFilter==="todos"||(pilotFilter==="piloto"?wantsPilot:!wantsPilot);
    return matchesSearch&&matchesPilot;
  }),[responses,query,pilotFilter]);

  const metrics=useMemo(()=>({
    total:responses.length,
    pilot:responses.filter(item=>item.respostas?.piloto==="Sim, quero participar").length,
    urgent:responses.filter(item=>item.respostas?.urgencia==="Agora").length,
    active:responses.filter(item=>!["Ainda não investe",undefined].includes(item.respostas?.midia)).length,
  }),[responses]);

  const sendMagicLink=async(event)=>{
    event.preventDefault();setLoginError("");
    if(!supabase){setLoginError("As variáveis do Supabase não estão configuradas.");return}
    const{error}=await supabase.auth.signInWithOtp({email:ADMIN_EMAIL,options:{emailRedirectTo:`${window.location.origin}/admin`}});
    if(error)setLoginError("Não conseguimos enviar o link. Confira a configuração de autenticação no Supabase.");
    else setLoginSent(true);
  };

  const exportCsv=()=>{
    const keys=diagnosisSteps.map(item=>item.key);
    const header=["Data","Nome","Empresa","Telefone","E-mail",...keys.map(key=>answerLabels[key])];
    const rows=filtered.map(item=>[new Date(item.created_at).toLocaleString("pt-BR"),item.nome,item.empresa,item.telefone,item.email,...keys.map(key=>item.respostas?.[key])]);
    const blob=new Blob([[header,...rows].map(row=>row.map(csvValue).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const href=URL.createObjectURL(blob);const link=document.createElement("a");link.href=href;link.download=`creatvos-respostas-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(href);
  };

  if(!authReady)return <main className="admin-loading"><span/><p>Preparando o portal</p></main>;
  if(!session)return <main className="admin-login"><section className="admin-login-story"><img src={logo} alt="CreatvOS"/><div><small>PORTAL DE PESQUISA</small><h1>As respostas<br/>que orientam <em>o produto.</em></h1><p>Acesso reservado para acompanhar os sinais, dores e oportunidades encontrados na pesquisa.</p></div><span>CREATVOS · BRASIL</span></section><section className="admin-login-form"><form onSubmit={sendMagicLink}><LockKeyhole/><small>ACESSO PROTEGIDO</small><h2>Entrar no portal</h2><p>Enviaremos um link seguro para o e-mail autorizado.</p><label>E-mail<input type="email" value={ADMIN_EMAIL} readOnly/></label><button type="submit">{loginSent?"Enviar novamente":"Enviar link de acesso"}<ArrowRight/></button>{loginSent&&<div className="admin-login-notice"><Check/> Link enviado. Abra o e-mail neste dispositivo.</div>}{loginError&&<div className="admin-login-error">{loginError}</div>}</form></section></main>;
  if(!authorized)return <main className="admin-denied"><LockKeyhole/><small>ACESSO NÃO AUTORIZADO</small><h1>Este e-mail não tem acesso ao portal.</h1><p>O acesso está reservado para {ADMIN_EMAIL}.</p><button onClick={()=>supabase.auth.signOut()}>Sair desta conta</button></main>;

  return <main className="admin-page">
    <header className="admin-topbar"><a href="/"><img src={logo} alt="CreatvOS"/></a><div><span>PORTAL DE PESQUISA</span><i>ACESSO PRIVADO</i></div><nav><button onClick={loadResponses} title="Atualizar"><RefreshCw/></button><button onClick={exportCsv} disabled={!filtered.length}><Download/><span>Exportar CSV</span></button><button onClick={()=>supabase.auth.signOut()} title="Sair"><LogOut/></button></nav></header>
    <section className="admin-intro"><div><small>DESCOBERTA CONTÍNUA</small><h1>O que o mercado<br/>está tentando <em>nos dizer.</em></h1></div><p>Um lugar para encontrar padrões nas respostas e decidir o que merece ser construído primeiro.</p></section>
    <section className="admin-metrics"><article><span>TOTAL DE RESPOSTAS</span><strong>{metrics.total}</strong><small>pessoas ouvidas</small></article><article><span>QUEREM TESTAR</span><strong>{metrics.pilot}</strong><small>interesse no piloto</small></article><article><span>PRECISAM AGORA</span><strong>{metrics.urgent}</strong><small>urgência declarada</small></article><article><span>JÁ INVESTEM</span><strong>{metrics.active}</strong><small>operações com mídia</small></article></section>
    <section className="admin-board"><div className="admin-controls"><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar nome, empresa ou e-mail"/></label><select value={pilotFilter} onChange={event=>setPilotFilter(event.target.value)}><option value="todos">Todos os perfis</option><option value="piloto">Quer participar do piloto</option><option value="outros">Demais respostas</option></select><span>{filtered.length} {filtered.length===1?"resposta":"respostas"}</span></div>
      <div className="admin-table-head"><span>CONTATO</span><span>OPERAÇÃO</span><span>INVESTIMENTO</span><span>SINAL</span><span>DATA</span><span/></div>
      <div className="admin-response-list">{loading?<div className="admin-empty"><RefreshCw/><h3>Carregando respostas</h3></div>:dataError?<div className="admin-empty"><LockKeyhole/><h3>{dataError}</h3></div>:filtered.length?filtered.map(item=><button className="admin-response-row" key={item.id} onClick={()=>setSelected(item)}><span><b>{item.nome||"Sem nome"}</b><small>{item.email}</small></span><span><b>{item.empresa||"Não informada"}</b><small>{item.respostas?.operacao||"Sem categoria"}</small></span><span><b>{item.respostas?.investimento||"Não informado"}</b><small>{item.respostas?.midia||"Mídia não informada"}</small></span><span className={item.respostas?.piloto==="Sim, quero participar"?"admin-signal hot":"admin-signal"}>{item.respostas?.piloto==="Sim, quero participar"?"QUER TESTAR":"ACOMPANHAR"}</span><time>{new Date(item.created_at).toLocaleDateString("pt-BR")}</time><Eye/></button>):<div className="admin-empty"><Inbox/><h3>Nenhuma resposta encontrada</h3><p>Ajuste a busca ou aguarde novas respostas.</p></div>}</div>
    </section>
    {selected&&<div className="admin-drawer-backdrop" onClick={()=>setSelected(null)}><aside className="admin-drawer" onClick={event=>event.stopPropagation()}><header><div><small>RESPOSTA COMPLETA</small><h2>{selected.nome}</h2><p>{selected.empresa} · {selected.email}</p></div><button onClick={()=>setSelected(null)}><X/></button></header><div className="admin-answer-list">{diagnosisSteps.map(item=>{const value=selected.respostas?.[item.key];return <article key={item.key}><span>{item.label}</span><p>{Array.isArray(value)?value.join(" · "):value||"Não informado"}</p></article>})}</div></aside></div>}
  </main>;
}

function App(){const join=()=>window.location.assign("/pesquisa");return <><Header onJoin={join}/><Hero onJoin={join}/></>}
const page=window.location.pathname.replace(/\/$/,"");
createRoot(document.getElementById("root")).render(<StrictMode>{page==="/pesquisa"?<ConversationalResearchPage/>:page==="/admin"?<AdminPortal/>:<App/>}</StrictMode>);
