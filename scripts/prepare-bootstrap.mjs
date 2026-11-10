// One-time bootstrap from the explicitly authorized quiet window. Never starts a deploy.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { captureSnapshot, validateSnapshot, encryptSnapshot, decryptSnapshot, verifySnapshotDatabase, sha256 } from '../lib/release-runtime.mjs';

const { values } = parseArgs({ options: {
  backup: { type: 'string' },
  'key-file': { type: 'string' },
  'target-version': { type: 'string' },
  'quiet-window-confirmed': { type: 'boolean', default: false },
} });
if (!values.backup || !values['key-file'] || !values['target-version'] || !values['quiet-window-confirmed']) throw new Error('Richiede --backup CARTELLA --key-file FILE_PRIVATO --target-version VERSIONE e --quiet-window-confirmed. Non presumere il consenso alla prima installazione.');
const backup = resolve(values.backup), targetVersion = values['target-version'];
if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) throw new Error('Versione non valida.');
const secret = /^BACKUP_ENCRYPTION_KEY=([a-f0-9]{96})\s*$/.exec(readFileSync(resolve(values['key-file']), 'utf8'))?.[1];
if (!secret) throw new Error('File chiave privato non valido.');
const verification = JSON.parse(readFileSync(join(backup, 'verification.json'), 'utf8'));
if (!verification.verified) throw new Error('Il backup non è verificato.');
for (const file of JSON.parse(readFileSync(join(backup, 'manifest.json'), 'utf8'))) {
  const bytes = readFileSync(join(backup, file.path));
  if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw new Error('Un file del backup è cambiato.');
}
process.env.DATABASE_PATH = join(backup, 'render', 'colletta.sqlite');
const source = new DatabaseSync(process.env.DATABASE_PATH, { readOnly: true });
let snapshot;
try { snapshot = captureSnapshot(source); } finally { source.close(); }
const payload = validateSnapshot(snapshot);
verifySnapshotDatabase(process.env.DATABASE_PATH, payload);
const packageFile = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = { format: 1, bootstrap: true, releaseId: randomUUID(), targetVersion, sourceVersion: 'legacy', preparedAt: new Date().toISOString(), archiveSha256: sha256(snapshot) };
const encrypted = encryptSnapshot(snapshot, manifest, secret);
manifest.encryptedSha256 = sha256(encrypted);
if (!decryptSnapshot(encrypted, manifest, secret).equals(snapshot)) throw new Error('Verifica della cifratura fallita.');
const privateDirectory = resolve('..', 'BACKUP', `bootstrap-${manifest.releaseId}`);
mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
writeFileSync(join(privateDirectory, 'backup.gz'), snapshot, { mode: 0o600, flag: 'wx' });
writeFileSync(join(privateDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
mkdirSync('.deployment', { recursive: true });
writeFileSync('.deployment/restore.enc', encrypted);
writeFileSync('.deployment/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
packageFile.version = targetVersion; writeFileSync('package.json', JSON.stringify(packageFile, null, 2) + '\n');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lock.version = targetVersion; lock.packages[''].version = targetVersion; writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(JSON.stringify({ prepared: true, deployStarted: false, version: targetVersion, releaseId: manifest.releaseId, registrations: verification.online_registrations, documents: payload.documents.length, backupDirectory: privateDirectory }));
