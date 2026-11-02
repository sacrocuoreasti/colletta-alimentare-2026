import { authorizationFile } from "../../../../db";
import { requireSession,fileResponse,apiError } from "../../../../lib/api";
export const runtime="nodejs";
export async function GET(request:Request){try{return fileResponse(authorizationFile(requireSession(request,"minor").registration_id!,Number(new URL(request.url).searchParams.get("index")||0)));}catch(e){return apiError(e);}}
