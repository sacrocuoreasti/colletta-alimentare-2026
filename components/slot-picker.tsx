"use client";
import { Check } from "lucide-react";
import { stores,storeIds,allHours,timeLabel,type Shift,type SlotAvailability } from "../lib/registration";
type Props={shifts:Shift[];onChange:(shifts:Shift[])=>void;slots:SlotAvailability[];ownShifts?:Shift[]};
export function SlotPicker({shifts,onChange,slots,ownShifts=[]}:Props) {
  function toggle(store:Shift["store"],hour:number) {
    onChange(shifts.some(s=>s.store===store&&s.hour===hour)?shifts.filter(s=>!(s.store===store&&s.hour===hour)):[...shifts,{store,hour}].sort((a,b)=>a.hour-b.hour));
  }
  return <div className="selection-grid">
    <p className="helper-text">Seleziona le celle dei turni che vuoi svolgere. I numeri indicano iscritti / posti massimi.</p>
    <div className="table-scroll"><table className="coverage-table selection-table"><thead><tr><th scope="col">Orario</th>{storeIds.map(store=><th key={store} scope="col">{stores[store].name}<small>{stores[store].address||"15:00–19:00"}</small></th>)}</tr></thead><tbody>
      {allHours.map(hour=><tr key={hour}><th scope="row">{timeLabel(hour)}–{timeLabel(hour+1)}</th>{storeIds.map(store=>{
        if(!stores[store].hours.includes(hour))return <td key={store} className="unavailable-cell" aria-label={`${stores[store].name}, fascia non prevista`}>—</td>;
        const slot=slots.find(s=>s.store===store&&s.hour===hour);
        const selected=shifts.some(s=>s.store===store&&s.hour===hour);
        const overlap=shifts.some(s=>s.store!==store&&s.hour===hour);
        const own=ownShifts.some(s=>s.store===store&&s.hour===hour)?1:0;
        const remaining=slot?.capacity==null?null:Math.max(0,slot.capacity-slot.booked+own);
        const full=remaining===0;
        const disabled=overlap||!slot||(!selected&&full);
        const description=overlap?"Ora già scelta":!slot?"Caricamento…":selected?"Selezionato":full?"Completo":remaining==null?"Scegli turno":`${remaining} ${remaining===1?"posto libero":"posti liberi"}`;
        const state=selected?"selected":overlap?"overlap":full?"full":slot?.booked===0?"empty":"partial";
        return <td className="selection-td" key={store}><button type="button" className={`selection-cell ${state}`} disabled={disabled} aria-pressed={selected} aria-label={`${stores[store].name}, ${timeLabel(hour)}–${timeLabel(hour+1)}, ${slot?slot.booked+" iscritti su "+(slot.capacity??"posti senza limite"):""}, ${description}`} onClick={()=>toggle(store,hour)}>
          <strong>{slot?`${slot.booked}/${slot.capacity??"∞"}`:"…"}</strong><span>{selected&&<Check size={12}/>} {description}</span>
        </button></td>;
      })}</tr>)}
    </tbody></table></div>
    <p className="selection-key"><span><i className="coverage-swatch empty"/>Nessun iscritto</span><span><i className="coverage-swatch partial"/>Posti disponibili</span><span><i className="coverage-swatch full"/>Completo</span><span><Check size={12}/>La tua scelta</span></p>
  </div>;
}
