import { AppError, sessionFromToken } from "../db";
import { ReleaseError } from "./release-runtime.mjs";
export function tokenFromRequest(request:Request) { return request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith("colletta_session="))?.slice("colletta_session=".length)||""; }
export function requireSession(request:Request,role?:"admin"|"minor") {
  const session=sessionFromToken(tokenFromRequest(request));
  if(!session || (role && session.role!==role))throw new AppError("Accedi con il tuo codice per continuare.",401);
  return session;
}
export function checkOrigin(request:Request) {
  const origin=request.headers.get("origin");
  if(origin) {
    try { if(new URL(origin).host!==(request.headers.get("host")||new URL(request.url).host))throw new Error(); }
    catch{throw new AppError("Richiesta non consentita.",403);}
  }
}
export async function readBoundedBody(request:Request,limit:number) {
  if(Number(request.headers.get("content-length"))>limit)throw new AppError("Richiesta troppo grande.",413);
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new AppError("Richiesta troppo grande.",413);}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}return data;
}
export async function readJson(request:Request) {
  checkOrigin(request);
  const body=new TextDecoder().decode(await readBoundedBody(request,20000));
  try{return JSON.parse(body);}catch{throw new AppError("Dati non validi.");}
}
export function json(data:unknown,status=200) { return Response.json(data,{status,headers:{"Cache-Control":"no-store"}}); }
export function apiError(error:unknown) {
  if(error instanceof AppError||error instanceof ReleaseError)return json({error:error.message},error.status);
  console.error("Errore del server",error instanceof Error?error.message:"errore sconosciuto");
  return json({error:"Operazione non riuscita. Riprova tra poco."},503);
}
export function sessionCookie(token:string,request:Request) {
  const secure=new URL(request.url).protocol==="https:" || request.headers.get("x-forwarded-proto")==="https";
  return `colletta_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?28800:0}${secure?"; Secure":""}`;
}
export function fileResponse(file:{bytes:Buffer;type:string;name:string}) {
  return new Response(new Uint8Array(file.bytes),{headers:{"Content-Type":file.type,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
