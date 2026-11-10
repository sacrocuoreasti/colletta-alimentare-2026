import { releaseStatus, releaseFiles } from "../../../lib/release-runtime.mjs";
import packageInfo from "../../../package.json";
export const runtime="nodejs";
export async function GET(request:Request){
  // Keep health information current; do not prerender the release state.
  void request.headers.get("host");
  let releaseId=null;
  try{releaseId=releaseFiles().manifest.releaseId;}catch{}
  return Response.json({version:packageInfo.version,revision:process.env.RENDER_GIT_COMMIT||"local",releaseId,releaseProtocol:1,maintenance:!!releaseStatus(),backupReady:(process.env.BACKUP_ENCRYPTION_KEY||"").length>=32},{headers:{"Cache-Control":"no-store"}});
}
