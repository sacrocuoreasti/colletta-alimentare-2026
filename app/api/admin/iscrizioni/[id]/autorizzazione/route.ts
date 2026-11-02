import { authorizationFile } from "../../../../../../db";
import { requireSession,fileResponse,apiError } from "../../../../../../lib/api";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{requireSession(request,"admin");return fileResponse(authorizationFile((await context.params).id,Number(new URL(request.url).searchParams.get("index")||0)));}catch(e){return apiError(e);}}
