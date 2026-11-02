import { z } from "zod";
export const registrationSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1, "Inserisci il nome.").max(80),
  lastName: z.string().trim().min(1, "Inserisci il cognome.").max(80),
  phone: z.string().trim().regex(/^\+?[\d\s().-]{6,25}$/, "Inserisci un numero di telefono valido.").refine(v => v.replace(/\D/g, '').length >= 6 && v.replace(/\D/g, '').length <= 15, "Controlla il numero di telefono."),
  email: z.union([z.string().trim().email("Controlla l’indirizzo email.").max(254), z.literal("")]),
  shifts: z.array(z.object({ store: z.enum(["despar", "penny"]), hour: z.number().int().min(8).max(19) })).min(1, "Scegli almeno una fascia oraria.").max(12),
}).refine(v => new Set(v.shifts.map(s => s.hour)).size === v.shifts.length, { message: "Le fasce orarie non possono sovrapporsi.", path: ["shifts"] });
export const stores = { despar: {name: "Despar", address: "Corso Alba"}, penny: {name: "Penny", address: "Corso Venezia"} };
export type Shift = { store: keyof typeof stores; hour: number };
export const timeLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
