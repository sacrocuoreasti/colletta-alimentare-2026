"use client";
import { Check,Plus } from "lucide-react";
import { stores,timeLabel,type Shift,type SlotAvailability } from "../lib/registration";
type Props={shifts:Shift[];onChange:(shifts:Shift[])=>void;slots:SlotAvailability[];ownShifts?:Shift[]};
export function SlotPicker({shifts,onChange,slots,ownShifts=[]}:Props) {
  function toggle(store:Shift["store"],hour:number) {
    onChange(shifts.some(s=>s.store===store&&s.hour===hour)?shifts.filter(s=>!(s.store===store&&s.hour===hour)):[...shifts,{store,hour}].sort((a,b)=>a.hour-b.hour));
  }
  return <div className="stores">{(Object.keys(stores) as Shift["store"][]).map(store=><fieldset className="store" key={store}>
    <legend>{stores[store].name}<span className="store-address">{stores[store].address}</span></legend>
    <div className="slots">{Array.from({length:12},(_,i)=>i+8).map(hour=>{
      const selected=shifts.some(s=>s.store===store&&s.hour===hour);
      const overlap=shifts.some(s=>s.store!==store&&s.hour===hour);
      const slot=slots.find(s=>s.store===store&&s.hour===hour);
      const own=ownShifts.some(s=>s.store===store&&s.hour===hour)?1:0;
      const remaining=slot?.capacity==null?null:Math.max(0,slot.capacity-slot.booked+own);
      const full=remaining===0;
      const disabled=overlap||!slot||(!selected&&full);
      const description=overlap?"Ora scelta nell’altro supermercato":!slot?"Caricamento…":full?"Completo":remaining==null?"Posti senza limite":`${remaining} ${remaining===1?"posto libero":"posti liberi"} su ${slot.capacity}`;
      return <button key={hour} type="button" className={`slot ${selected?"selected":""}`} disabled={disabled} aria-pressed={selected} aria-label={`${stores[store].name}, ${timeLabel(hour)}–${timeLabel(hour+1)}, ${description}`} onClick={()=>toggle(store,hour)}>
        <span className="slot-content"><span>{timeLabel(hour)}–{timeLabel(hour+1)}</span><small>{description}</small></span>{selected?<Check size={13}/>:<Plus size={13}/>}</button>;
    })}</div>
  </fieldset>)}</div>;
}
