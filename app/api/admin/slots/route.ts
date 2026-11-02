import { z } from "zod";
import { storeIds,stores } from "../../../../lib/registration";
import { setCapacities,listSlots } from "../../../../db";
import { requireSession,readJson,json,apiError } from "../../../../lib/api";
export const runtime="nodejs";
const slot=z.object({store:z.enum(storeIds),hour:z.number().int().min(8).max(19),capacity:z.number().int().min(0).max(10000).nullable()}).refine(s=>stores[s.store].hours.includes(s.hour));
const schema=z.object({slots:z.array(slot).min(1).max(28)}).refine(v=>new Set(v.slots.map(s=>s.store+"-"+s.hour)).size===v.slots.length);
export async function PATCH(request:Request){try{requireSession(request,"admin");const result=schema.safeParse(await readJson(request));if(!result.success)return json({error:"Inserisci una capienza valida (0 o più), oppure lascia vuoto per nessun limite."},400);setCapacities(result.data.slots);return json({slots:listSlots()});}catch(e){return apiError(e);}}
