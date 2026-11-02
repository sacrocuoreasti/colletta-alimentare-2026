import { listSlots } from "../../../db";
import { json,apiError } from "../../../lib/api";
export const runtime="nodejs";
export async function GET(){try{return json({slots:listSlots()});}catch(e){return apiError(e);}}
