import { updateRegistration,deleteRegistration } from "../../../../../db";
import { registrationSchema } from "../../../../../lib/registration";
import { requireSession,readJson,json,apiError,checkOrigin } from "../../../../../lib/api";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Context){try{requireSession(request,"admin");const {id}=await context.params;const body=await readJson(request);const result=registrationSchema.safeParse({...body,id});if(!result.success)return json({error:result.error.issues[0].message},400);return json({registration:updateRegistration(id,result.data)});}catch(e){return apiError(e);}}
export async function DELETE(request:Request,context:Context){try{checkOrigin(request);requireSession(request,"admin");deleteRegistration((await context.params).id);return json({ok:true});}catch(e){return apiError(e);}}
