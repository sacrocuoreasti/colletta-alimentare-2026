import { listRegistrations, listSlots } from "../../../../../db";
import { requireSession, apiError } from "../../../../../lib/api";
import { rosterExcel } from "../../../../../lib/roster-excel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireSession(request, "admin");
    const bytes = await rosterExcel(listRegistrations(), listSlots());
    return new Response(bytes, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="turni-colletta-2026.xlsx"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return apiError(error); }
}
