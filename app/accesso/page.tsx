"use client";
import { useState } from "react";
import { SiteHeader,SiteFooter } from "../../components/site-header";
export default function Access(){
  const [code,setCode]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  return <div className="site"><SiteHeader/><main className="layout access-layout"><p className="eyebrow">LA TUA ISCRIZIONE</p><h1>Carica autorizzazione</h1><p className="intro-text">Inserisci il codice personale ricevuto dopo l’iscrizione del minore.</p>
    <form className="access-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/accesso",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});const body=await response.json();if(!response.ok)throw new Error(body.error);window.location.assign(body.role==="admin"?"/admin":"/autorizzazione");}catch(err){setError(err instanceof Error?err.message:"Accesso non riuscito.");setBusy(false);}}}>
      <div className="fields"><label className="full">Codice di accesso<input name="code" required maxLength={64} autoComplete="off" spellCheck={false} autoCapitalize="off" value={code} onChange={e=>setCode(e.target.value)} placeholder="Il tuo codice"/></label></div>
      {error&&<p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy?"Accesso…":"Accedi"}</button>
    </form><p className="helper-text">Non trovi il codice? Contatta gli organizzatori per recuperarlo.</p><a className="back" href="/">← Torna all’iscrizione</a>
  </main><SiteFooter/></div>;
}
