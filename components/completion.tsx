"use client";
import { useState } from "react";
import { Download,ExternalLink,Upload,Copy,Check } from "lucide-react";
import { stores,timeLabel,type Shift } from "../lib/registration";
export const portalUrl="https://colletta26.bancoalimentare.it/user/otp?destination=/";
export function MinorInstructions(){return <div className="instructions">
  <h3>Compila l’autorizzazione</h3>
  <ol><li>Scarica il modulo di due pagine e compilalo con i tuoi genitori: dati del minore, accompagnatore, città e supermercato.</li><li>Fai apporre le firme richieste nella prima pagina. Leggi e compila anche la sezione consenso e firme nella seconda pagina.</li><li>Carica entrambe le pagine in un unico PDF oppure in due foto, una per pagina, usando il tuo codice.</li></ol>
  <a className="outline-button" href="/documenti/autorizzazione-minori-2026.pdf" download><Download size={16}/> Scarica il modulo PDF</a>
</div>;}
export function AdultGuide({shifts=[]}:{shifts?:Shift[]}) {
  const selectedStores=Array.from(new Set(shifts.map(s=>s.store)));
  const steps=[
    {title:"Accedi e inserisci i dati personali",text:<>Apri il portale del Banco Alimentare e segui la richiesta di accesso con codice temporaneo. Compila i dati personali e tutti i campi contrassegnati da asterisco.</>,images:["dati-personali.png"]},
    {title:"Scegli “Me stesso” e “Punto vendita”",text:<>Nel passaggio “Tipologia volontario”, scegli <strong>Me stesso</strong> e poi <strong>Punto vendita</strong>.</>,images:["1.png"]},
    {title:"Indica se hai bisogno di essere contattato",text:<>Se non sei il capo équipe scegli <strong>No</strong> alla prima domanda. Se hai già concordato qui turni e punto vendita, scegli <strong>No</strong> alla necessità di contatto; se ti servono accordi o chiarimenti scegli <strong>Sì</strong>.</>,images:["2.png"]},
    {title:"Seleziona il supermercato e gli orari",text:<>Scegli <strong>Piemonte → AT → Asti</strong>, quindi il supermercato: <strong>DESPAR – Corso Alba 68, Asti</strong> oppure <strong>PENNY – Corso Venezia, Asti</strong>. Riporta la disponibilità concordata. {selectedStores.length>1&&<>Se hai scelto turni in entrambi i supermercati, sul portale selezionane uno solo. </>}{selectedStores.length>0&&<>Qui hai scelto: {selectedStores.map(s=>stores[s].name+" · "+stores[s].address).join("; ")}.</>}</>,images:["3a.png","3b.png"]},
    {title:"Leggi l’informativa ed esprimi le tue scelte",text:<>Leggi l’informativa e completa tutte le sezioni del consenso. Per newsletter, fotografie e video scegli liberamente se prestare o meno il consenso: le selezioni mostrate negli screenshot sono soltanto un esempio.</>,images:["4.png"]},
    {title:"Controlla il riepilogo e premi “Invia”",text:<>Verifica dati, punto vendita e orari, poi premi <strong>INVIA</strong>. Secondo il vademecum riceverai anche un riepilogo via email. Il salvataggio su questo sito completa solo l’iscrizione interna.</>,images:["5.png"]},
  ];
  return <div className="instructions adult-guide">
    <h3>Registrati sul portale Banco Alimentare</h3>
    <p>L’iscrizione al portale va completata personalmente, anche se hai già scelto qui i turni.</p>
    <a className="primary link-button" href={portalUrl} target="_blank" rel="noreferrer">Apri il portale Banco Alimentare <ExternalLink size={16}/></a>
    {shifts.length>0&&<p className="chosen-shifts">I tuoi turni: {shifts.map(s=>`${stores[s.store].name} ${timeLabel(s.hour)}–${timeLabel(s.hour+1)}`).join(" · ")}</p>}
    <h4>Guida passo passo</h4>
    <div className="guide-steps">{steps.map((step,i)=><details key={step.title} open={i===0}><summary><span>{i+1}</span>{step.title}</summary><div className="guide-content"><p>{step.text}</p>{step.images.map(src=><a key={src} className="guide-image-link" href={`/guida/${src}`} target="_blank" rel="noreferrer" aria-label={`Ingrandisci lo screenshot: ${step.title}`}><img src={`/guida/${src}`} alt={`Esempio del portale: ${step.title}`} loading="lazy"/><span>Ingrandisci screenshot ↗</span></a>)}</div></details>)}</div>
    <a className="back" href="/documenti/vademecum-volontari-2026.pdf" download><Download size={16}/> Scarica il vademecum completo</a>
  </div>;
}
export function Completion({isMinor,code,shifts}:{isMinor:boolean;code:string;shifts:Shift[]}) {
  const [copied,setCopied]=useState(false);
  return isMinor?<>
    <div className="code-card"><span className="small-label">IL TUO CODICE PERSONALE</span><strong className="personal-code">{code}</strong><p><strong>Fai uno screenshot di questa schermata per non dimenticarlo.</strong></p><p>Ti servirà per tornare qui e caricare l’autorizzazione, anche in un altro momento. Conservalo e non condividerlo.</p><button className="back" onClick={async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setCopied(false);}}}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?"Codice copiato":"Copia codice"}</button></div>
    <MinorInstructions/><a href="/autorizzazione" className="primary link-button"><Upload size={16}/> Carica autorizzazione</a>
  </>:<AdultGuide shifts={shifts}/>;
}
