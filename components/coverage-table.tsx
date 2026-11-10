import { stores,timeLabel,type Shift,type SlotAvailability } from "../lib/registration";
import { buildRoster,coverageState,slotKey,type RosterVolunteer } from "../lib/shift-roster";
export function CoverageTable({slots,registrations}:{slots:SlotAvailability[];registrations?:RosterVolunteer[]}){
  const names=registrations!==undefined;
  const roster=buildRoster(registrations||[]);
  const titleId=names?"roster-title":"coverage-title";
  return <section className={`coverage-section${names?" roster-section":""}`} aria-labelledby={titleId}><h2 id={titleId}>{names?"Turni nominativi":"Copertura dei turni"}</h2><p className="helper-text">{names?"Nome e cognome dei volontari per sede e fascia oraria, in ordine di cognome. Aggiornamento ogni 15 secondi.":"Iscritti / posti massimi · ∞ = nessun limite · Aggiornamento ogni 15 secondi."}</p>
    <div className="coverage-legend"><span><i className="coverage-swatch full"/>Pieno</span><span><i className="coverage-swatch empty"/>Nessun iscritto</span><span><i className="coverage-swatch partial"/>Parzialmente coperto</span></div>
    <div className="table-scroll"><table className="coverage-table"><thead><tr><th scope="col">Orario</th>{(Object.keys(stores) as Shift["store"][]).map(store=><th key={store} scope="col">{stores[store].name}<small>{stores[store].address}</small></th>)}</tr></thead><tbody>
      {Array.from({length:12},(_,i)=>i+8).map(hour=><tr key={hour}><th scope="row">{timeLabel(hour)}–{timeLabel(hour+1)}</th>{(Object.keys(stores) as Shift["store"][]).map(store=>{
        const slot=slots.find(s=>s.store===store&&s.hour===hour);
        if(!slot)return <td key={store} className="unavailable-cell" aria-label={`${stores[store].name}, fascia non prevista`}>—</td>;
        const state=coverageState(slot);
        const description=slot.capacity===0?"Turno chiuso":slot.booked===0?"Nessun iscritto":state==="full"?"Turno pieno":"Turno parzialmente coperto";
        const people=roster.get(slotKey(slot))||[];
        return <td key={store} className={`coverage-cell ${state}`} aria-label={names?undefined:`${stores[store].name}, ${slot.booked} iscritti, ${slot.capacity===null?"nessun limite":slot.capacity+" posti massimi"}. ${description}`}>
          {names?(people.length?<ul className="roster-names">{people.map(person=><li key={person.id}>{person.firstName} {person.lastName}</li>)}</ul>:<span className="roster-empty">Nessun iscritto</span>):<strong>{slot.booked}/{slot.capacity??"∞"}</strong>}
          {slot.capacity===0&&<small>Chiuso</small>}
        </td>;
      })}</tr>)}
    </tbody></table></div>
  </section>;
}
