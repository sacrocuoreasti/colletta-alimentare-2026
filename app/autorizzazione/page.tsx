"use client";
import { useEffect,useRef,useState } from "react";
import { SiteHeader,SiteFooter } from "../../components/site-header";
import { MinorInstructions } from "../../components/completion";
type Status={firstName:string;hasAuthorization:boolean;authorizationFiles:{name:string;type:string}[];uploadedAt:string|null};
export default function Authorization(){
  const [status,setStatus]=useState<Status|null>(null);const [mode,setMode]=useState<"pdf"|"photos">("pdf");const [files,setFiles]=useState<(File|null)[]>([null,null]);const [confirmed,setConfirmed]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);const formRef=useRef<HTMLFormElement>(null);
  useEffect(()=>{fetch("/api/autorizzazione",{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);setStatus(body);}).catch(e=>setError(e.message)).finally(()=>setLoaded(true));},[]);
  const chosen=mode==="pdf"?[files[0]]:files;
  const valid=chosen.every(file=>file&&file.size>0&&file.size<=10*1024*1024);
  function changeMode(value:"pdf"|"photos"){setMode(value);setFiles([null,null]);setConfirmed(false);setError("");setSuccess("");formRef.current?.reset();}
  function choose(index:number,file:File|null){setFiles(previous=>previous.map((v,i)=>i===index?file:v));setSuccess("");setError(file&&file.size>10*1024*1024?"Ogni file può pesare al massimo 10 MB.":"");}
  return <div className="site"><SiteHeader/><main className="layout"><p className="eyebrow">AUTORIZZAZIONE MINORENNI</p><h1>{status?`Ciao ${status.firstName}!`:"Carica autorizzazione"}</h1>
    {!loaded?<p className="intro-text">Caricamento…</p>:!status?<><p className="error" role="alert">{error}</p><a className="primary link-button" href="/accesso">Accedi con il tuo codice</a></>:<>
      <p className="intro-text">Qui puoi caricare l’autorizzazione firmata o sostituirla.</p><MinorInstructions/>
      {status.hasAuthorization&&<div className="success-banner file-status"><strong>Autorizzazione ricevuta</strong>{status.authorizationFiles.map((file,i)=><a key={i} href={`/api/autorizzazione/file?index=${i}`}>{file.type==="application/pdf"?"Scarica PDF":`Scarica foto ${i+1}`} · {file.name}</a>)}<small>I documenti sono disponibili agli organizzatori per la verifica.</small></div>}
      <form ref={formRef} className="upload-form" onSubmit={async e=>{e.preventDefault();if(!valid)return;setBusy(true);setError("");setSuccess("");try{const form=new FormData();for(const file of chosen)if(file)form.append("file",file);form.set("confirmed",String(confirmed));const response=await fetch("/api/autorizzazione",{method:"POST",body:form});const body=await response.json();if(!response.ok)throw new Error(body.error);setStatus(body);setSuccess("Autorizzazione caricata correttamente.");setFiles([null,null]);setConfirmed(false);formRef.current?.reset();}catch(err){setError(err instanceof Error?err.message:"Caricamento non riuscito.");}finally{setBusy(false);}}}>
        <h2>{status.hasAuthorization?"Sostituisci autorizzazione":"Carica autorizzazione"}</h2>
        <fieldset className="age-choice upload-choice" disabled={busy}><legend>Come vuoi caricare il modulo?</legend><label><input type="radio" name="upload-type" checked={mode==="pdf"} onChange={()=>changeMode("pdf")}/> Un PDF</label><label><input type="radio" name="upload-type" checked={mode==="photos"} onChange={()=>changeMode("photos")}/> Due foto</label></fieldset>
        {mode==="pdf"?<label key="pdf" className="file-input-label">PDF con entrambe le pagine<input type="file" required disabled={busy} accept="application/pdf,.pdf" onChange={e=>choose(0,e.target.files?.[0]||null)}/></label>:<div className="photo-fields">{[0,1].map(i=><label key={`photo-${i}`} className="file-input-label">Foto {i+1} · Pagina {i+1}<input type="file" required disabled={busy} accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={e=>choose(i,e.target.files?.[0]||null)}/></label>)}</div>}
        <p className="helper-text">{mode==="pdf"?"Un unico PDF con entrambe le pagine.":"Una foto per ciascuna pagina: JPG, PNG o WebP. Le firme e il testo devono essere leggibili."} Massimo 10 MB per file. Un nuovo caricamento sostituisce tutti i file precedenti.</p>
        <label className="checkbox-label"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confermo che il modulo include entrambe le pagine compilate e le firme richieste.</label>
        {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success-banner" role="status">{success}</p>}
        <button className="primary" disabled={busy||!valid||!confirmed}>{busy?"Caricamento…":status.hasAuthorization?"Sostituisci autorizzazione":"Carica autorizzazione"}</button>
      </form><button className="back" disabled={busy} onClick={async()=>{await fetch("/api/accesso",{method:"DELETE"});window.location.assign("/accesso");}}>Esci</button>
    </>}
  </main><SiteFooter/></div>;
}
