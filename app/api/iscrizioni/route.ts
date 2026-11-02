import { getDb } from "../../../db";
import { registrations } from "../../../db/schema";
import { registrationSchema } from "../../../lib/registration";
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({error:"Richiesta non consentita."},{status:403});
  let payload;
  try { const body = await request.text(); if (body.length > 10000) return Response.json({error:"Richiesta troppo grande."},{status:413}); payload = JSON.parse(body); }
  catch { return Response.json({error:"Dati non validi."},{status:400}); }
  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) return Response.json({error:parsed.error.issues[0].message},{status:400});
  try {
    const {id,firstName,lastName,phone,email,shifts} = parsed.data;
    await getDb().insert(registrations).values({id,firstName,lastName,phone,email:email || null,shifts:JSON.stringify(shifts)}).onConflictDoNothing();
    return Response.json({id},{status:201,headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"Non è stato possibile salvare l’iscrizione. Riprova tra poco: i dati inseriti restano nel modulo."},{status:503}); }
}
