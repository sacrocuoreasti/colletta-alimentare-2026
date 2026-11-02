import { stores,timeLabel,type Shift,type SlotAvailability } from "../lib/registration";
export function CoverageTable({slots}:{slots:SlotAvailability[]}){
  return <section className="coverage-section" aria-labelledby="coverage-title"><h2 id="coverage-title">Copertura dei turni</h2><p className="helper-text">Iscritti / posti massimi · ∞ = nessun limite · Aggiornamento ogni 15 secondi.</p>
    <div className="coverage-legend"><span><i className="coverage-swatch full"/>Pieno</span><span><i className="coverage-swatch empty"/>Nessun iscritto</span><span><i className="coverage-swatch partial"/>Parzialmente coperto</span></div>
    <div className="table-scroll"><table className="coverage-table"><thead><tr><th scope="col">Orario</th>{(Object.keys(stores) as Shift["store"][]).map(store=><th key={store} scope="col">{stores[store].name}<small>{stores[store].address}</small></th>)}</tr></thead><tbody>
      {Array.from({length:12},(_,i)=>i+8).map(hour=><tr key={hour}><th scope="row">{timeLabel(hour)}–{timeLabel(hour+1)}</th>{(Object.keys(stores) as Shift["store"][]).map(store=>{
        const slot=slots.find(s=>s.store===store&&s.hour===hour);
        if(!slot)return <td key={store} className="unavailable-cell" aria-label={`${stores[store].name}, fascia non prevista`}>—</td>;
        const full=slot.capacity!==null&&slot.capacity>0&&slot.booked>=slot.capacity;
        const state=slot.booked===0?"empty":full?"full":"partial";
        const description=slot.capacity===0?"Turno chiuso":slot.booked===0?"Nessun iscritto":full?"Turno pieno":"Turno parzialmente coperto";
        return <td key={store} className={`coverage-cell ${state}`} aria-label={`${stores[store].name}, ${slot.booked} iscritti, ${slot.capacity===null?"nessun limite":slot.capacity+" posti massimi"}. ${description}`}><strong>{slot.booked}/{slot.capacity??"∞"}</strong>{slot.capacity===0&&<small>Chiuso</small>}</td>;
      })}</tr>)}
    </tbody></table></div>
  </section>;
}
