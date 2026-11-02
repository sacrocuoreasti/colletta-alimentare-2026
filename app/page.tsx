"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { ArrowRight,ArrowLeft,Check,Clock3,LockKeyhole,Plus,X } from "lucide-react";
import { registrationSchema,stores,timeLabel,type Shift,type SlotAvailability } from "../lib/registration";
import { SiteHeader,SiteFooter } from "../components/site-header";
import { SlotPicker } from "../components/slot-picker";
import { Completion } from "../components/completion";
export default function Home() {
  const [stage,setStage]=useState<"details"|"shifts"|"review"|"done">("details");
  const [person,setPerson]=useState({firstName:"",lastName:"",phone:"",email:"",isMinor:null as boolean|null});
  const [shifts,setShifts]=useState<Shift[]>([]);
  const [slots,setSlots]=useState<SlotAvailability[]>([]);
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [minorCode,setMinorCode]=useState("");
  const id=useRef("");const heading=useRef<HTMLHeadingElement>(null);
  const loadSlots=useCallback(async()=>{
    try{const response=await fetch("/api/slots",{cache:"no-store"});if(!response.ok)throw new Error();const body=await response.json();setSlots(body.slots);}
    catch{setError("Non è stato possibile aggiornare i posti disponibili. Riprova tra poco.");}
  },[]);
  useEffect(()=>{loadSlots();const timer=setInterval(loadSlots,15000);window.addEventListener("focus",loadSlots);return()=>{clearInterval(timer);window.removeEventListener("focus",loadSlots);};},[loadSlots]);
  function go(next:typeof stage){setError("");setStage(next);setTimeout(()=>heading.current?.focus(),0);}
  async function save(){
    if(busy)return;if(!id.current)id.current=crypto.randomUUID();
    const result=registrationSchema.safeParse({...person,id:id.current,shifts});
    if(!result.success){setError(result.error.issues[0].message);return;}
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/iscrizioni",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(result.data)});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Invio non riuscito. Riprova.");
      setMinorCode(body.minorCode||"");go("done");
    }catch(e){setError(e instanceof Error?e.message:"Connessione non disponibile. Riprova.");loadSlots();}finally{setBusy(false);}
  }
  function newRegistration(){setPerson({firstName:"",lastName:"",phone:"",email:"",isMinor:null});setShifts([]);setMinorCode("");id.current="";go("details");loadSlots();}
  return <div className="site"><SiteHeader/><main className="layout">
    <div className="intro"><p className="eyebrow">VOLONTARI · 14 NOVEMBRE 2026</p><h1>Colletta Alimentare <span>2026</span></h1><p className="intro-text">Lascia i tuoi contatti e scegli quando dare una mano.</p></div>
    <section className="form-area" aria-label="Iscrizione volontari">
      <nav className="steps" aria-label="Passaggi dell’iscrizione">
        <div className="step active"><span>{stage==="done"?<Check size={15}/>:"1"}</span><div>Iscrizione interna</div></div><div className="step-line"/>
        <div className={`step ${stage==="done"?"active":"future"}`}><span>2</span><div>{person.isMinor===true?"Autorizzazione":person.isMinor===false?"Portale Banco Alimentare":"Portale o modulo"}</div></div>
      </nav>
      <div className="form-card">
        <div className="card-top"><span className="small-pill">{stage==="details"?"1. Dati personali":stage==="shifts"?"2. Disponibilità":stage==="review"?"3. Riepilogo":"Iscrizione interna salvata"}</span></div>
        <h2 ref={heading} tabIndex={-1}>{stage==="details"?"I tuoi dati":stage==="shifts"?"Scegli i turni":stage==="review"?"Riepilogo":"Completa la partecipazione"}</h2>
        <p className="card-description">{stage==="details"?"Nome, cognome e telefono sono obbligatori. L’email è facoltativa.":stage==="shifts"?"Scegli una o più ore, anche in sedi diverse.":stage==="review"?"Controlla i dati e i turni prima di confermare.":"La disponibilità è registrata. Ti resta questo ultimo passaggio."}</p>
        {stage==="details"&&<form onSubmit={e=>{e.preventDefault();if(person.isMinor===null){setError("Indica se sei maggiorenne o minorenne.");return;}const parsed=registrationSchema.safeParse({...person,id:"00000000-0000-4000-8000-000000000000",shifts:[{store:"despar",hour:8}]});if(!parsed.success){setError(parsed.error.issues[0].message);return;}loadSlots();go("shifts");}}>
          <div className="fields">
            <label>Nome *<input name="firstName" autoComplete="given-name" required maxLength={80} placeholder="Il tuo nome" value={person.firstName} onChange={e=>setPerson({...person,firstName:e.target.value})}/></label>
            <label>Cognome *<input name="lastName" autoComplete="family-name" required maxLength={80} placeholder="Il tuo cognome" value={person.lastName} onChange={e=>setPerson({...person,lastName:e.target.value})}/></label>
            <label className="full">Numero di telefono *<input name="phone" autoComplete="tel" type="tel" required maxLength={25} placeholder="Es. 333 123 4567" value={person.phone} onChange={e=>setPerson({...person,phone:e.target.value})}/><small>Per gli aggiornamenti sui turni.</small></label>
            <label className="full">Email <span className="optional">Facoltativa</span><input name="email" autoComplete="email" type="email" maxLength={254} placeholder="La tua email" value={person.email} onChange={e=>setPerson({...person,email:e.target.value})}/></label>
          </div>
          <fieldset className="age-choice"><legend>Il giorno della Colletta avrai già 18 anni? *</legend><label><input type="radio" name="age" required checked={person.isMinor===false} onChange={()=>setPerson({...person,isMinor:false})}/> Sì, sarò maggiorenne</label><label><input type="radio" name="age" checked={person.isMinor===true} onChange={()=>setPerson({...person,isMinor:true})}/> No, sarò minorenne</label></fieldset>
          <p className="required-note">* Campi obbligatori</p>{error&&<p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit">Scegli i tuoi turni <ArrowRight size={18}/></button><p className="privacy"><LockKeyhole size={13}/> I contatti servono a organizzare la tua partecipazione.</p>
        </form>}
        {stage==="shifts"&&<>
          <div className="slot-help"><Clock3 size={16}/><span>Turni da un’ora · Despar e Penny 08:00–20:00 · Oratorio 15:00–19:00</span></div>
          <SlotPicker shifts={shifts} onChange={setShifts} slots={slots}/>
          <p className="selection-info" aria-live="polite">{shifts.length?`${shifts.length} ${shifts.length===1?"ora selezionata":"ore selezionate"}`:"Scegli almeno un turno"}<span>Non puoi scegliere la stessa ora in due sedi.</span></p>
          {error&&<><p className="error" role="alert">{error}</p><button className="back" onClick={loadSlots}>Aggiorna disponibilità</button></>}
          <div className="actions"><button className="back" onClick={()=>go("details")}><ArrowLeft size={16}/> Indietro</button><button className="primary" disabled={!shifts.length||!slots.length} onClick={()=>go("review")}>Rivedi l’iscrizione <ArrowRight size={17}/></button></div>
        </>}
        {stage==="review"&&<>
          <div className="summary-person"><strong>{person.firstName} {person.lastName}</strong><span>{person.phone}</span>{person.email&&<span>{person.email}</span>}<span>{person.isMinor?"Minorenne":"Maggiorenne"}</span></div>
          <div className="summary-label">LA TUA DISPONIBILITÀ <b>{shifts.length} {shifts.length===1?"ora":"ore"}</b></div>
          <ul className="summary-shifts">{shifts.map(s=><li key={`${s.store}-${s.hour}`}><span><strong>{stores[s.store].name}</strong><small>{stores[s.store].address}</small></span><span>{timeLabel(s.hour)}–{timeLabel(s.hour+1)}</span><button disabled={busy} aria-label={`Rimuovi ${stores[s.store].name} ${timeLabel(s.hour)}`} onClick={()=>setShifts(shifts.filter(x=>x!==s))}><X size={15}/></button></li>)}</ul>
          {error&&<p className="error" role="alert">{error}</p>}<div className="actions"><button className="back" disabled={busy} onClick={()=>go("shifts")}><ArrowLeft size={16}/> Modifica</button><button className="primary" disabled={busy||!shifts.length} onClick={save}>{busy?"Salvataggio…":"Conferma iscrizione"}{!busy&&<Check size={17}/>}</button></div>
        </>}
        {stage==="done"&&<><Completion isMinor={!!person.isMinor} code={minorCode} shifts={shifts}/><button className="back another-registration" onClick={newRegistration}><Plus size={16}/> Iscrivi un’altra persona</button></>}
      </div>
    </section>
  </main><SiteFooter/></div>;
}
