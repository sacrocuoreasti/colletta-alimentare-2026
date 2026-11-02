import { minorStatus,uploadAuthorization } from "../../../db";
import { requireSession,json,apiError,checkOrigin,readBoundedBody } from "../../../lib/api";
export const runtime="nodejs";
export async function GET(request:Request){try{return json(minorStatus(requireSession(request,"minor").registration_id!));}catch(e){return apiError(e);}}
export async function POST(request:Request) {
  try {
    checkOrigin(request);const session=requireSession(request,"minor");
    const bytes=await readBoundedBody(request,21*1024*1024);
    const form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
    const files=form.getAll("file");
    if(files.length<1||files.length>2||files.some(file=>!(file instanceof File)||file.size===0))return json({error:"Seleziona un PDF oppure due foto."},400);
    const uploads=files as File[];
    if(uploads.some(file=>file.size>10*1024*1024))return json({error:"Ogni file può pesare al massimo 10 MB."},413);
    if(form.get("confirmed")!=="true")return json({error:"Conferma che il modulo è compilato e firmato."},400);
    uploadAuthorization(session.registration_id!,await Promise.all(uploads.map(async file=>({bytes:Buffer.from(await file.arrayBuffer()),name:file.name}))));
    return json(minorStatus(session.registration_id!));
  }catch(e){return apiError(e);}
}
