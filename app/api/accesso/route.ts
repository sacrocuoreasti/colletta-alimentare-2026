import { login,endSession } from "../../../db";
import { readJson,json,apiError,sessionCookie,requireSession,tokenFromRequest,checkOrigin } from "../../../lib/api";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const body=await readJson(request);
    if(typeof body.code!=="string"||body.code.length>100)return json({error:"Inserisci il codice."},400);
    const client=request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()||"local";
    const result=login(body.code.trim(),client);
    const response=json({role:result.role});response.headers.set("Set-Cookie",sessionCookie(result.token,request));return response;
  }catch(e){return apiError(e);}
}
export async function GET(request:Request){try{return json({role:requireSession(request).role});}catch(e){return apiError(e);}}
export async function DELETE(request:Request){try{checkOrigin(request);endSession(tokenFromRequest(request));const response=json({ok:true});response.headers.set("Set-Cookie",sessionCookie("",request));return response;}catch(e){return apiError(e);}}
