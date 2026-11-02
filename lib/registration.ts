import { z } from "zod";
export const storeIds=["despar","penny","oratorio"] as const;
export type StoreId=typeof storeIds[number];
export const allHours=Array.from({length:12},(_,i)=>i+8);
export const stores:Record<StoreId,{name:string;address:string;hours:readonly number[]}>= {
  despar:{name:"Despar",address:"Corso Alba",hours:allHours},
  penny:{name:"Penny",address:"Corso Venezia",hours:allHours},
  oratorio:{name:"Oratorio",address:"",hours:[15,16,17,18]},
};
export const shiftSchema=z.object({store:z.enum(storeIds),hour:z.number().int().min(8).max(19)}).refine(s=>stores[s.store].hours.includes(s.hour),{message:"Questa fascia non è disponibile nella sede scelta."});
export const registrationSchema = z.object({
  id: z.string().uuid(),
  isMinor: z.boolean({ required_error: "Indica se sei maggiorenne o minorenne." }),
  firstName: z.string().trim().min(1, "Inserisci il nome.").max(80),
  lastName: z.string().trim().min(1, "Inserisci il cognome.").max(80),
  phone: z.string().trim().regex(/^\+?[\d\s().-]{6,25}$/, "Inserisci un numero di telefono valido.").refine(v => v.replace(/\D/g, '').length >= 6 && v.replace(/\D/g, '').length <= 15, "Controlla il numero di telefono."),
  email: z.union([z.string().trim().email("Controlla l’indirizzo email.").max(254), z.literal("")]),
  shifts: z.array(shiftSchema).min(1, "Scegli almeno una fascia oraria.").max(12),
}).refine(v => new Set(v.shifts.map(s => s.hour)).size === v.shifts.length, { message: "Le fasce orarie non possono sovrapporsi.", path: ["shifts"] });
export type Shift = { store: StoreId; hour: number };
export const timeLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
export type SlotAvailability = Shift & { capacity: number | null; booked: number };
