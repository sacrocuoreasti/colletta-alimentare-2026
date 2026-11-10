import { createHash, randomBytes, randomUUID, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const businessTables = ['registrations', 'slot_limits', 'issued_codes'];
const magic = Buffer.from('COLLETTA2026BACKUP1\n');
const globalKey = Symbol.for('colletta.release.gates');
const gates = globalThis[globalKey] ||= new Map();
export const dataPath = () => resolve(process.env.DATABASE_PATH || 'data/colletta.sqlite');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const statePath = () => join(dirname(dataPath()), '.release-state.json');
const markerPath = () => join(dirname(dataPath()), '.release-restored.json');
const deploymentDirectory = () => resolve(process.env.DEPLOYMENT_DIRECTORY || '.deployment');
const currentVersion = () => JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;

export class ReleaseError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}
function saveJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const pending = file + '.pending';
  writeFileSync(pending, JSON.stringify(value), { mode: 0o600 }); renameSync(pending, file);
}
function gate() {
  const key = dataPath();
  if (!gates.has(key)) gates.set(key, { active: 0, waiters: [], state: existsSync(statePath()) ? JSON.parse(readFileSync(statePath(), 'utf8')) : null });
  return gates.get(key);
}
export function releaseStatus() { return gate().state; }
export async function withRegistrationWrite(fn) {
  const g = gate();
  if (g.state) throw new ReleaseError('Aggiornamento in corso. Iscrizioni e caricamenti sono temporaneamente sospesi; riprova tra poco.');
  g.active++;
  try { return await fn(); }
  finally { if (--g.active === 0) for (const done of g.waiters.splice(0)) done(); }
}
async function freeze(targetVersion) {
  const g = gate();
  if (g.state) throw new ReleaseError('Un rilascio è già in preparazione.', 409);
  g.state = { releaseId: randomUUID(), targetVersion, preparedAt: new Date().toISOString() };
  saveJson(statePath(), g.state);
  if (g.active) {
    let timer;
    try {
      await Promise.race([new Promise(done => g.waiters.push(done)), new Promise((_, reject) => { timer = setTimeout(() => reject(new ReleaseError('Richieste ancora in corso. Rilascio annullato; riprovare.')), 30000); })]);
    } catch (error) { resume(); throw error; }
    finally { clearTimeout(timer); }
  }
  return g.state;
}
function resume() { gate().state = null; rmSync(statePath(), { force: true }); }
function encryptionKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (value.length < 32) throw new ReleaseError('Configura BACKUP_ENCRYPTION_KEY (almeno 32 caratteri casuali) prima del rilascio.');
  return value;
}
export function encryptSnapshot(bytes, manifest, secret = encryptionKey()) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(secret, salt, 32), iv);
  cipher.setAAD(Buffer.from(JSON.stringify({ releaseId: manifest.releaseId, targetVersion: manifest.targetVersion })));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptSnapshot(bytes, manifest, secret = encryptionKey()) {
  if (!bytes.subarray(0, magic.length).equals(magic) || bytes.length < magic.length + 44) throw new ReleaseError('Formato dello snapshot non valido.');
  const offset = magic.length;
  const cipher = createDecipheriv('aes-256-gcm', scryptSync(secret, bytes.subarray(offset, offset + 16), 32), bytes.subarray(offset + 16, offset + 28));
  cipher.setAuthTag(bytes.subarray(offset + 28, offset + 44));
  cipher.setAAD(Buffer.from(JSON.stringify({ releaseId: manifest.releaseId, targetVersion: manifest.targetVersion })));
  return Buffer.concat([cipher.update(bytes.subarray(offset + 44)), cipher.final()]);
}
function businessDigest(db) {
  const tables = businessTables.map(table => [table, db.prepare(`SELECT * FROM ${table}`).all().map(row => JSON.stringify(row)).sort()]);
  return sha256(JSON.stringify(tables));
}
function uploadFiles(root, prefix = '') {
  if (!existsSync(root)) return [];
  return readdirSync(root).sort().flatMap(name => {
    const file = join(root, name), entry = lstatSync(file);
    if (entry.isSymbolicLink()) throw new ReleaseError('Allegato simbolico non ammesso nel backup.');
    const key = prefix + name;
    return entry.isDirectory() ? uploadFiles(file, key + '/') : [{ path: key, sha256: sha256(readFileSync(file)), bytes: readFileSync(file).toString('base64') }];
  });
}
export function validateSnapshot(bytes) {
  const payload = JSON.parse(gunzipSync(bytes));
  if (payload.format !== 1 || !payload.database || !Array.isArray(payload.documents) || !payload.businessDigest) throw new ReleaseError('Backup incompleto.');
  const database = Buffer.from(payload.database.bytes, 'base64');
  if (sha256(database) !== payload.database.sha256) throw new ReleaseError('Checksum database errato.');
  const paths = new Set();
  for (const file of payload.documents) {
    if (typeof file.path !== 'string' || !file.path || isAbsolute(file.path) || file.path.split(/[\\/]/).some(part => part === '..' || part === '.' || !part) || paths.has(file.path)) throw new ReleaseError('Percorso documento non valido.');
    paths.add(file.path);
    if (sha256(Buffer.from(file.bytes, 'base64')) !== file.sha256) throw new ReleaseError('Checksum documento errato.');
  }
  return payload;
}
export function verifySnapshotDatabase(file, payload) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || businessDigest(db) !== payload.businessDigest) throw new ReleaseError('Database non corrispondente al backup.');
    for (const row of db.prepare('SELECT file_key, files_json FROM registrations').all()) {
      const files = row.files_json ? JSON.parse(row.files_json) : row.file_key ? [{ key: row.file_key }] : [];
      for (const file of files) if (!payload.documents.some(document => document.path === file.key)) throw new ReleaseError('Manca un documento collegato a un’iscrizione.');
    }
  } finally { db.close(); }
}
export function captureSnapshot(db) {
  const root = dirname(dataPath()); mkdirSync(root, { recursive: true });
  const temporary = mkdtempSync(join(root, '.release-backup-'));
  try {
    const file = join(temporary, 'database.sqlite');
    db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
    const bytes = readFileSync(file);
    const payload = { format: 1, businessDigest: businessDigest(db), database: { sha256: sha256(bytes), bytes: bytes.toString('base64') }, documents: uploadFiles(join(root, 'autorizzazioni')) };
    verifySnapshotDatabase(file, payload);
    return gzipSync(Buffer.from(JSON.stringify(payload)));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
export async function prepareRelease(db, targetVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(targetVersion) || targetVersion.localeCompare(currentVersion(), 'en', { numeric: true }) <= 0) throw new ReleaseError('La versione di destinazione deve essere successiva a quella online.', 400);
  encryptionKey();
  const state = await freeze(targetVersion);
  try {
    const snapshot = captureSnapshot(db);
    const manifest = { format: 1, ...state, sourceVersion: currentVersion(), archiveSha256: sha256(snapshot) };
    const encrypted = encryptSnapshot(snapshot, manifest);
    manifest.encryptedSha256 = sha256(encrypted);
    return { manifest, backup: snapshot.toString('base64'), encrypted: encrypted.toString('base64') };
  } catch (error) { resume(); throw error; }
}
export function releaseFiles() {
  const directory = deploymentDirectory();
  const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
  const encrypted = readFileSync(join(directory, 'restore.enc'));
  if (manifest.format !== 1 || manifest.targetVersion !== currentVersion() || sha256(encrypted) !== manifest.encryptedSha256) throw new ReleaseError('Deploy bloccato: snapshot mancante, alterato o appartenente a un’altra versione.');
  return { manifest, encrypted };
}
export function checkRenderRelease() {
  if (process.env.RENDER || existsSync(join(deploymentDirectory(), 'manifest.json'))) releaseFiles();
}
function loadedSnapshot() {
  const { manifest, encrypted } = releaseFiles();
  const bytes = decryptSnapshot(encrypted, manifest);
  if (sha256(bytes) !== manifest.archiveSha256) throw new ReleaseError('Archivio ripristino alterato.');
  return { manifest, payload: validateSnapshot(bytes) };
}
export function restoreRelease() {
  // Production snapshots must never replace the separate local development database.
  if (!process.env.RENDER) return;
  const { manifest, payload } = loadedSnapshot();
  if (existsSync(markerPath()) && JSON.parse(readFileSync(markerPath(), 'utf8')).releaseId === manifest.releaseId) return;
  const root = dirname(dataPath()); mkdirSync(root, { recursive: true });
  const temporary = mkdtempSync(join(root, '.release-restore-'));
  try {
    const candidate = join(temporary, 'database.sqlite');
    writeFileSync(candidate, Buffer.from(payload.database.bytes, 'base64'), { mode: 0o600 }); verifySnapshotDatabase(candidate, payload);
    // Never replace an existing database with a snapshot. Matching persistent data can be retained.
    if (existsSync(dataPath())) verifySnapshotDatabase(dataPath(), payload);
    for (const file of payload.documents) {
      const target = resolve(root, 'autorizzazioni', file.path);
      if (relative(resolve(root, 'autorizzazioni'), target).startsWith('..')) throw new ReleaseError('Percorso documento non valido.');
      if (existsSync(target) && sha256(readFileSync(target)) !== file.sha256) throw new ReleaseError('Documento esistente diverso: ripristino interrotto senza sovrascriverlo.');
    }
    for (const file of payload.documents) {
      const target = resolve(root, 'autorizzazioni', file.path);
      if (!existsSync(target)) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, Buffer.from(file.bytes, 'base64'), { mode: 0o600, flag: 'wx' }); }
    }
    if (!existsSync(dataPath())) renameSync(candidate, dataPath());
    saveJson(statePath(), { releaseId: manifest.releaseId, targetVersion: manifest.targetVersion, restored: true });
    gates.delete(dataPath()); saveJson(markerPath(), { releaseId: manifest.releaseId });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
export function completeRelease(db) {
  const { manifest, payload } = loadedSnapshot();
  if (!releaseStatus()?.restored || releaseStatus().releaseId !== manifest.releaseId) throw new ReleaseError('Nessun ripristino da verificare.', 409);
  if (businessDigest(db) !== payload.businessDigest) throw new ReleaseError('Confronto fallito: iscrizioni, turni o codici differenti.', 409);
  for (const file of payload.documents) {
    const target = join(dirname(dataPath()), 'autorizzazioni', file.path);
    if (!existsSync(target) || sha256(readFileSync(target)) !== file.sha256) throw new ReleaseError('Confronto documenti fallito.', 409);
  }
  resume(); return { matches: true, releaseId: manifest.releaseId };
}
export function cancelRelease() {
  if (releaseStatus()?.restored) throw new ReleaseError('Verifica il nuovo rilascio prima di riaprire.', 409);
  resume(); return { cancelled: true };
}
