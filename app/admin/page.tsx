"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { SiteHeader,SiteFooter } from "../../components/site-header";
import { CoverageTable } from "../../components/coverage-table";
import { SlotPicker } from "../../components/slot-picker";
import { stores,timeLabel,type SlotAvailability,type Shift } from "../../lib/registration";
import type { RecordView } from "../../db";
const key=(s:{store:string;hour:number})=>`${s.store}-${s.hour}`;
async function adminData():Promise<{registrations:RecordView[];slots:SlotAvailability[]}>{
  const response=await fetch("/api/admin/iscrizioni",{cache:"no-store"});const body=await response.json();
  if(!response.ok)throw new Error(body.error||"Caricamento non riuscito.");return body;
}
export default function Admin(){
  const [allowed,setAllowed]=useState(false);const [loading,setLoading]=useState(true);const [tab,setTab]=useState<"coverage"|"names"|"registrations"|"capacity">("coverage");
  const [exporting,setExporting]=useState(false);
  const [records,setRecords]=useState<RecordView[]>([]);const [slots,setSlots]=useState<SlotAvailability[]>([]);const [limits,setLimits]=useState<Record<string,string>>({});
  const [query,setQuery]=useState("");const [filter,setFilter]=useState("all");const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const [edit,setEdit]=useState<RecordView|null>(null);const [deleting,setDeleting]=useState<RecordView|null>(null);const [dialogError,setDialogError]=useState("");const dialog=useRef<HTMLDialogElement>(null);
  const load=useCallback(async()=>{
    const data=await adminData();
    setAllowed(true);setRecords(data.registrations);setSlots(data.slots);setLimits(Object.fromEntries(data.slots.map(v=>[key(v),v.capacity==null?"":String(v.capacity)])));
  },[]);
  const refreshSlots=useCallback(async()=>{
    const data=await adminData();setRecords(data.registrations);setSlots(data.slots);
  },[]);
  useEffect(()=>{if(!allowed)return;const refresh=()=>{refreshSlots().catch(e=>setError(e.message));};const timer=setInterval(refresh,15000);window.addEventListener("focus",refresh);return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);};},[allowed,refreshSlots]);
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[load]);
  useEffect(()=>{if(edit||deleting){setDialogError("");dialog.current?.showModal();}else dialog.current?.close();},[!!edit,!!deleting]);
  async function mutate(url:string,method:string,body?:unknown){
    const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Operazione non riuscita.");return result;
  }
  async function downloadExcel(){
    setExporting(true);setError("");
    try{
      const response=await fetch("/api/admin/turni/excel",{cache:"no-store"});
      if(!response.ok){const result=await response.json();throw new Error(result.error||"Download non riuscito.");}
      const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");
      link.href=url;link.download="turni-colletta-2026.xlsx";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError((e as Error).message);}finally{setExporting(false);}
  }
  const visible=records.filter(r=>`${r.firstName} ${r.lastName} ${r.phone} ${r.email} ${r.accessCode||""}`.toLowerCase().includes(query.toLowerCase())&&(filter==="all"||(filter==="minor"&&r.isMinor)||(filter==="adult"&&!r.isMinor)||(filter==="pending"&&r.isMinor&&!r.hasAuthorization)));
  const pending=records.filter(r=>r.isMinor&&!r.hasAuthorization).length;
  function close(){if(busy)return;setEdit(null);setDeleting(null);setDialogError("");}
  return <div className="site"><SiteHeader/><main className="admin-layout">
    <div className="admin-heading"><div><p className="eyebrow">ORGANIZZAZIONE</p><h1>Pannello admin</h1></div>{allowed&&<div className="admin-heading-actions"><button className="outline-button" disabled={exporting} onClick={downloadExcel}>{exporting?"Preparazione Excel…":"Scarica Excel"}</button><button className="back" onClick={async()=>{await fetch("/api/accesso",{method:"DELETE"});window.location.assign("/accesso");}}>Esci</button></div>}</div>
    {loading?<p>Caricamento…</p>:!allowed?<><p className="error" role="alert">{error}</p><a className="primary link-button" href="/accesso">Accedi</a></>:<>
      <div className="admin-stats"><div><strong>{records.length}</strong><span>Iscrizioni</span></div><div><strong>{records.filter(r=>r.isMinor).length}</strong><span>Minorenni</span></div><div><strong>{pending}</strong><span>Autorizzazioni da caricare</span></div></div>
      <nav className="admin-tabs" aria-label="Sezioni admin"><button aria-pressed={tab==="coverage"} onClick={()=>{setTab("coverage");setError("");setMessage("");}}>Copertura turni</button><button aria-pressed={tab==="names"} onClick={()=>{setTab("names");setError("");setMessage("");}}>Turni nominativi</button><button aria-pressed={tab==="registrations"} onClick={()=>{setTab("registrations");setError("");setMessage("");}}>Iscrizioni</button><button aria-pressed={tab==="capacity"} onClick={()=>{setTab("capacity");setError("");setMessage("");}}>Capienze dei turni</button></nav>
      {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}
      {tab==="coverage"?<CoverageTable slots={slots}/>:tab==="names"?<CoverageTable slots={slots} registrations={records}/>:tab==="registrations"?<>
        <div className="admin-filters"><label>Cerca<input type="search" placeholder="Nome, telefono, email o codice" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Mostra<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tutte le iscrizioni</option><option value="minor">Minorenni</option><option value="adult">Maggiorenni</option><option value="pending">Autorizzazioni mancanti</option></select></label><button className="outline-button" disabled={busy} onClick={async()=>{setError("");try{await load();}catch(e){setError((e as Error).message);}}}>Aggiorna</button></div>
        <p className="helper-text">{visible.length} iscrizioni mostrate. Lo stato “Caricata” indica la ricezione del file, da verificare manualmente.</p>
        {visible.length===0?<p className="empty-state">Nessuna iscrizione trovata.</p>:<div className="table-scroll"><table className="registrations-table"><thead><tr><th>Volontario</th><th>Contatti</th><th>Turni</th><th>Autorizzazione</th><th>Azioni</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}>
          <td><strong>{r.firstName} {r.lastName}</strong><small>{r.isMinor?"Minorenne":"Maggiorenne"}</small>{r.accessCode&&<small>Codice: <b>{r.accessCode}</b></small>}</td>
          <td><a href={`tel:${r.phone}`}>{r.phone}</a>{r.email&&<small><a href={`mailto:${r.email}`}>{r.email}</a></small>}</td>
          <td><ul className="compact-shifts">{r.shifts.map(s=><li key={key(s)}>{stores[s.store].name} · {timeLabel(s.hour)}–{timeLabel(s.hour+1)}</li>)}</ul></td>
          <td>{r.isMinor?<><span className={`status-label ${r.hasAuthorization?"received":"pending"}`}>{r.hasAuthorization?"Caricata":"Da caricare"}</span>{r.hasAuthorization&&r.authorizationFiles.map((file,index)=><a key={index} className="table-link" href={`/api/admin/iscrizioni/${r.id}/autorizzazione?index=${index}`}>{file.type==="application/pdf"?"Scarica PDF":`Scarica foto ${index+1}`}</a>)}</>:<span className="helper-text">Portale esterno</span>}</td>
          <td><div className="row-actions"><button className="table-link" onClick={()=>{setEdit({...r,shifts:[...r.shifts]});setMessage("");}}>Modifica</button><button className="table-link danger" onClick={()=>setDeleting(r)}>Elimina</button></div></td>
        </tr>)}</tbody></table></div>}
      </>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");setMessage("");try{const updated=slots.map(s=>({...s,capacity:limits[key(s)]===""?null:Number(limits[key(s)])}));await mutate("/api/admin/slots","PATCH",{slots:updated});await load();setMessage("Capienze aggiornate. I nuovi posti sono visibili nel modulo di iscrizione.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
        <p className="helper-text">Lascia vuoto per nessun limite. Imposta 0 per chiudere il turno. Il massimo non può essere inferiore agli iscritti presenti.</p>
        <div className="capacity-grid">{(Object.keys(stores) as Shift["store"][]).map(store=><section key={store}><h2>{stores[store].name} <span>{stores[store].address}</span></h2><table className="capacity-table"><thead><tr><th>Fascia</th><th>Iscritti</th><th>Posti massimi</th></tr></thead><tbody>{slots.filter(s=>s.store===store).map(s=><tr key={key(s)}><td>{timeLabel(s.hour)}–{timeLabel(s.hour+1)}</td><td>{s.booked}</td><td><input aria-label={`Posti massimi ${stores[store].name} ${timeLabel(s.hour)}`} type="number" min={s.booked} max={10000} step={1} placeholder="Senza limite" value={limits[key(s)]??""} onChange={e=>setLimits({...limits,[key(s)]:e.target.value})}/></td></tr>)}</tbody></table></section>)}</div>
        <button className="primary" disabled={busy}>{busy?"Salvataggio…":"Salva capienze"}</button>
      </form>}
    </>}
    <dialog ref={dialog} aria-label="Gestisci iscrizione" className="admin-dialog" onCancel={e=>{if(busy)e.preventDefault();else close();}}>
      {deleting&&<><h2>Elimina iscrizione</h2><p>Vuoi eliminare l’iscrizione di <strong>{deleting.firstName} {deleting.lastName}</strong>? Saranno rimossi anche i turni e l’eventuale autorizzazione. L’operazione è definitiva.</p>{dialogError&&<p className="error" role="alert">{dialogError}</p>}<div className="actions"><button autoFocus className="back" disabled={busy} onClick={close}>Annulla</button><button className="primary danger-button" disabled={busy} onClick={async()=>{setBusy(true);try{await mutate(`/api/admin/iscrizioni/${deleting.id}`,"DELETE");await load();setDeleting(null);setMessage("Iscrizione eliminata e posti liberati.");}catch(e){setDialogError((e as Error).message);}finally{setBusy(false);}}}>{busy?"Eliminazione…":"Elimina definitivamente"}</button></div></>}
      {edit&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setDialogError("");try{await mutate(`/api/admin/iscrizioni/${edit.id}`,"PATCH",edit);await load();setEdit(null);setMessage("Iscrizione aggiornata.");}catch(e){setDialogError((e as Error).message);}finally{setBusy(false);}}}>
        <h2>Modifica iscrizione</h2><div className="fields">
          <label>Nome<input autoFocus required maxLength={80} value={edit.firstName} onChange={e=>setEdit({...edit,firstName:e.target.value})}/></label>
          <label>Cognome<input required maxLength={80} value={edit.lastName} onChange={e=>setEdit({...edit,lastName:e.target.value})}/></label>
          <label>Telefono<input required type="tel" maxLength={25} value={edit.phone} onChange={e=>setEdit({...edit,phone:e.target.value})}/></label>
          <label>Email<input type="email" maxLength={254} value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></label>
        </div><fieldset className="age-choice"><legend>Età il giorno della Colletta</legend><label><input type="radio" name="edit-age" checked={!edit.isMinor} onChange={()=>setEdit({...edit,isMinor:false})}/> Maggiorenne</label><label><input type="radio" name="edit-age" checked={edit.isMinor} onChange={()=>setEdit({...edit,isMinor:true})}/> Minorenne</label></fieldset>
        {!edit.isMinor&&records.find(r=>r.id===edit.id)?.isMinor&&<p className="notice">Passando a maggiorenne verranno rimossi il codice personale e l’eventuale autorizzazione caricata.</p>}
        <h3>Turni</h3><SlotPicker slots={slots} shifts={edit.shifts} ownShifts={records.find(r=>r.id===edit.id)?.shifts||[]} onChange={shifts=>setEdit({...edit,shifts})}/>
        {dialogError&&<p className="error" role="alert">{dialogError}</p>}<div className="actions"><button type="button" className="back" disabled={busy} onClick={close}>Annulla</button><button className="primary" disabled={busy||!edit.shifts.length}>{busy?"Salvataggio…":"Salva modifiche"}</button></div>
      </form>}
    </dialog>
  </main><SiteFooter/></div>;
}
