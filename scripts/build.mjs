import { spawnSync } from 'node:child_process';
import { checkRenderRelease } from '../lib/release-runtime.mjs';
checkRenderRelease();
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{stdio:'inherit',env:process.env});
process.exit(result.status??1);
