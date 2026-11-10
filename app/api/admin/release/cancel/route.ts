import { requireSession, checkOrigin, json, apiError } from "../../../../../lib/api";
import { cancelRelease } from "../../../../../lib/release-runtime.mjs";
export const runtime="nodejs";
export async function POST(request:Request){try{checkOrigin(request);requireSession(request,"admin");return json(cancelRelease());}catch(error){return apiError(error);}}
