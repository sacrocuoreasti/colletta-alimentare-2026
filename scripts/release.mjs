// Controlled releases. Refuses the legacy online version that cannot freeze writes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, validateSnapshot, verifySnapshotDatabase, checkRenderRelease } from '../lib/release-runtime.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
process.chdir(root);
const base = (process.env.RELEASE_BASE_URL || 'https://colletta-alimentare-2026.onrender.com').replace(/\/$/, '');
const origin = new URL(base);
if (origin.protocol !== 'https:' && origin.hostname !== '127.0.0.1') throw new Error('Usare HTTPS per il servizio online.');
let cookie;
async function request(path, body) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(120000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Richiesta ${path} non riuscita (${response.status}).`);
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return result;
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
let prepared = false, pushed = false;
try {
  let health;
  try { health = await request('/api/health'); }
  catch { throw new Error('Il sito online non dispone ancora del rilascio conservativo: installazione iniziale protetta necessaria. Nessun deploy eseguito.'); }
  if (health.releaseProtocol !== 1) throw new Error('Il server non supporta il blocco delle scritture. Nessun deploy eseguito.');
  await request('/api/accesso', { code: process.env.COLLETTA_ADMIN_CODE || 'ColSC26' });
  if (process.argv.includes('--cancel')) {
    await request('/api/admin/release/cancel', {}); console.log('Preparazione annullata sul vecchio server.'); process.exit(0);
  }
  if (!health.backupReady) throw new Error('Configura BACKUP_ENCRYPTION_KEY sul servizio prima del rilascio.');
  if (git('branch', '--show-current') !== 'main' || git('status', '--porcelain')) throw new Error('Committare prima le modifiche al codice su main; non fare push diretti.');
  for (const args of [['node_modules/typescript/bin/tsc', '--noEmit'], ['scripts/test-roster.mjs'], ['scripts/test-release.mjs']]) execFileSync(process.execPath, args, { stdio: 'inherit' });
  const packageFile = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = health.version.split('.').map(Number);
  if (version.length !== 3 || version.some(n => !Number.isSafeInteger(n))) throw new Error('Versione online non valida.');
  const targetVersion = `${version[0]}.${version[1]}.${version[2] + 1}`;
  const bundle = await request('/api/admin/release/prepare', { targetVersion }); prepared = true;
  const bytes = Buffer.from(bundle.backup, 'base64'), encrypted = Buffer.from(bundle.encrypted, 'base64');
  if (bundle.manifest.targetVersion !== targetVersion || sha256(bytes) !== bundle.manifest.archiveSha256 || sha256(encrypted) !== bundle.manifest.encryptedSha256) throw new Error('Manifest di backup non corrispondente.');
  const privateDirectory = resolve(root, '..', 'BACKUP', `release-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(join(privateDirectory, 'backup.gz'), bytes, { mode: 0o600, flag: 'wx' });
  const payload = validateSnapshot(bytes);
  const database = join(privateDirectory, 'verification.sqlite');
  writeFileSync(database, Buffer.from(payload.database.bytes, 'base64'), { mode: 0o600, flag: 'wx' }); verifySnapshotDatabase(database, payload);
  writeFileSync(join(privateDirectory, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2), { mode: 0o600 });
  console.log('Backup online completo verificato e salvato in:', privateDirectory);
  mkdirSync('.deployment', { recursive: true });
  writeFileSync('.deployment/restore.enc', encrypted);
  writeFileSync('.deployment/manifest.json', JSON.stringify(bundle.manifest, null, 2) + '\n');
  packageFile.version = targetVersion; writeFileSync('package.json', JSON.stringify(packageFile, null, 2) + '\n');
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  lock.version = targetVersion; lock.packages[''].version = targetVersion; writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  checkRenderRelease();
  execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
  git('add', 'package.json', 'package-lock.json', '.deployment/manifest.json', '.deployment/restore.enc');
  git('commit', '-m', `Release ${targetVersion} with verified encrypted online snapshot`);
  const revision = git('rev-parse', 'HEAD');
  pushed = true; // Network failure after sending a push must not reopen the old server.
  execFileSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    try {
      const status = await request('/api/health');
      if (status.revision === revision && status.releaseId === bundle.manifest.releaseId) {
        await request('/api/accesso', { code: process.env.COLLETTA_ADMIN_CODE || 'ColSC26' });
        const result = await request('/api/admin/release/complete', {});
        if (!result.matches) throw new Error('Confronto fallito.');
        console.log('Tutte le iscrizioni, i turni, i codici e i documenti coincidono. Sito riaperto.'); process.exit(0);
      }
    } catch { /* New process may not be healthy yet; keep maintenance enabled. */ }
    await new Promise(done => setTimeout(done, 5000));
  }
  throw new Error('Deploy non verificato entro 10 minuti: manutenzione mantenuta. Non forzare la riapertura.');
} catch (error) {
  if (prepared && !pushed) {
    try { await request('/api/admin/release/cancel', {}); }
    catch { console.error('Impossibile annullare automaticamente: verificare la manutenzione sul vecchio server.'); }
  }
  console.error(error.message); process.exitCode = 1;
}
