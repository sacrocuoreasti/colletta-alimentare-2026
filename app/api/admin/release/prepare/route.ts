import { getDatabase } from "../../../../../db";
import { requireSession, readJson, json, apiError } from "../../../../../lib/api";
import { prepareRelease } from "../../../../../lib/release-runtime.mjs";
export const runtime="nodejs";
export async function POST(request:Request){try{
  requireSession(request,"admin");const body=await readJson(request);
  if(typeof body.targetVersion!=="string")return json({error:"Specifica la versione di destinazione."},400);
  return json(await prepareRelease(getDatabase(),body.targetVersion));
}catch(error){return apiError(error);}}
