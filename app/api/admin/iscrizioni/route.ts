import { listRegistrations,listSlots } from "../../../../db";
import { requireSession,json,apiError } from "../../../../lib/api";
export const runtime="nodejs";
export async function GET(request:Request){try{requireSession(request,"admin");return json({registrations:listRegistrations(),slots:listSlots()});}catch(e){return apiError(e);}}
