import { getDatabase } from "../../../../../db";
import { requireSession, checkOrigin, json, apiError } from "../../../../../lib/api";
import { completeRelease } from "../../../../../lib/release-runtime.mjs";
export const runtime="nodejs";
export async function POST(request:Request){try{checkOrigin(request);requireSession(request,"admin");return json(completeRelease(getDatabase()));}catch(error){return apiError(error);}}
