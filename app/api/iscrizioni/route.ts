import { saveRegistration,createSession } from "../../../db";
import { registrationSchema } from "../../../lib/registration";
import { readJson,json,apiError,sessionCookie } from "../../../lib/api";
import { withRegistrationWrite } from "../../../lib/release-runtime.mjs";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    return await withRegistrationWrite(async()=>{
    const parsed=registrationSchema.safeParse(await readJson(request));
    if(!parsed.success)return json({error:parsed.error.issues[0].message},400);
    const saved=saveRegistration(parsed.data);
    const response=json({id:saved.id,minorCode:saved.accessCode},201);
    if(saved.isMinor)response.headers.set("Set-Cookie",sessionCookie(createSession("minor",saved.id),request));
    return response;
    });
  } catch(e){return apiError(e);}
}
