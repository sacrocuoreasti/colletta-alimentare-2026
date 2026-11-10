// Uses synthetic SQLite databases and documents only, all inside a temporary directory.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { prepareRelease, releaseStatus, withRegistrationWrite, cancelRelease, encryptSnapshot, decryptSnapshot, validateSnapshot, restoreRelease, completeRelease, checkRenderRelease, sha256 } from '../lib/release-runtime.mjs';

const originalDirectory=process.cwd();
const temporary=mkdtempSync(join(tmpdir(),'colletta-release-test-'));
const originalEnvironment={DATABASE_PATH:process.env.DATABASE_PATH,BACKUP_ENCRYPTION_KEY:process.env.BACKUP_ENCRYPTION_KEY,DEPLOYMENT_DIRECTORY:process.env.DEPLOYMENT_DIRECTORY,RENDER:process.env.RENDER};
let source,restored;
try{
  process.env.DATABASE_PATH=join(temporary,'source','colletta.sqlite');
  process.env.BACKUP_ENCRYPTION_KEY='synthetic-key-for-release-tests-only-2026';
  mkdirSync(join(temporary,'source','autorizzazioni'),{recursive:true});
  source=new DatabaseSync(process.env.DATABASE_PATH);
  source.exec(`CREATE TABLE registrations(id TEXT PRIMARY KEY,first_name TEXT,last_name TEXT,phone TEXT,shifts TEXT,access_code TEXT,file_key TEXT,files_json TEXT,created_at TEXT);
    CREATE TABLE slot_limits(store TEXT,hour INTEGER,capacity INTEGER,PRIMARY KEY(store,hour));
    CREATE TABLE issued_codes(code TEXT PRIMARY KEY);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY);
    INSERT INTO registrations VALUES('one','Anna','Test','3331234567','[{"store":"penny","hour":9}]','ABC','page.pdf',NULL,'2026-11-10 12:00:00');
    INSERT INTO issued_codes VALUES('ABC'),('OLD');
    INSERT INTO slot_limits VALUES('penny',9,4);`);
  const document=Buffer.from('%PDF-synthetic-test-document');
  writeFileSync(join(temporary,'source','autorizzazioni','page.pdf'),document);
  writeFileSync(join(temporary,'source','autorizzazioni','unreferenced.png'),Buffer.from('preserve extra files too'));
  let finish;
  const admitted=withRegistrationWrite(async()=>{await new Promise(done=>{finish=done;});source.exec("UPDATE registrations SET first_name='Updated before freeze' WHERE id='one'");});
  const preparing=prepareRelease(source,'99.0.0');
  assert(releaseStatus(),'Freeze before waiting for existing writes');
  await assert.rejects(withRegistrationWrite(async()=>{}),error=>error.status===503);
  finish();await admitted;
  const bundle=await preparing;
  assert.equal(bundle.manifest.targetVersion,'99.0.0');
  const bytes=Buffer.from(bundle.backup,'base64'), encrypted=Buffer.from(bundle.encrypted,'base64');
  assert.equal(sha256(bytes),bundle.manifest.archiveSha256);
  assert.equal(validateSnapshot(bytes).documents.length,2);
  assert.deepEqual(decryptSnapshot(encrypted,bundle.manifest),bytes);
  assert(!encrypted.includes(Buffer.from('Updated before freeze')));
  assert.throws(()=>decryptSnapshot(encrypted,bundle.manifest,'different-synthetic-test-secret-2026'));
  const altered=Buffer.from(encrypted);altered[altered.length-1]^=1;
  assert.throws(()=>decryptSnapshot(altered,bundle.manifest));
  const unsafe=JSON.parse(gunzipSync(bytes));unsafe.documents[0].path='../escape.pdf';
  assert.throws(()=>validateSnapshot(gzipSync(Buffer.from(JSON.stringify(unsafe)))));
  const corrupt=JSON.parse(gunzipSync(bytes));corrupt.documents[0].sha256='bad';
  assert.throws(()=>validateSnapshot(gzipSync(Buffer.from(JSON.stringify(corrupt)))));
  cancelRelease();assert.equal(releaseStatus(),null);
  await withRegistrationWrite(async()=>{});

  // A new instance has only the encrypted snapshot, manifest and a private environment key.
  const deployment=join(temporary,'deployment');mkdirSync(deployment);
  writeFileSync(join(deployment,'restore.enc'),encrypted);
  writeFileSync(join(deployment,'manifest.json'),JSON.stringify(bundle.manifest));
  writeFileSync(join(temporary,'package.json'),'{"version":"99.0.0"}');
  process.chdir(temporary);process.env.DEPLOYMENT_DIRECTORY=deployment;
  process.env.DATABASE_PATH=join(temporary,'untouched-local','colletta.sqlite');
  delete process.env.RENDER;restoreRelease();
  assert.equal(releaseStatus(),null,'A local server must ignore production snapshots');
  process.env.RENDER='true';
  process.env.DATABASE_PATH=join(temporary,'new-instance','colletta.sqlite');
  checkRenderRelease();restoreRelease();
  assert(releaseStatus().restored);
  assert.throws(()=>cancelRelease(),error=>error.status===409);
  await assert.rejects(withRegistrationWrite(async()=>{}));
  restored=new DatabaseSync(process.env.DATABASE_PATH);
  assert.equal(restored.prepare('SELECT first_name FROM registrations').get().first_name,'Updated before freeze');
  assert.deepEqual(restored.prepare('SELECT code FROM issued_codes ORDER BY code').all().map(r=>r.code),['ABC','OLD']);
  const restoredFile=join(temporary,'new-instance','autorizzazioni','page.pdf');
  assert.deepEqual(readFileSync(restoredFile),document);
  writeFileSync(restoredFile,'changed');
  assert.throws(()=>completeRelease(restored));assert(releaseStatus(),'Failed comparison must retain maintenance');
  writeFileSync(restoredFile,document);
  assert.equal(completeRelease(restored).matches,true);
  assert.equal(releaseStatus(),null);
  await withRegistrationWrite(async()=>{restored.exec("UPDATE registrations SET first_name='New after release' WHERE id='one'");});
  restoreRelease();
  assert.equal(restored.prepare('SELECT first_name FROM registrations').get().first_name,'New after release','Restart must not overwrite newer persistent data');
  restored.close();restored=null;
  // A mismatching existing database is never overwritten.
  process.env.DATABASE_PATH=join(temporary,'existing-instance','colletta.sqlite');mkdirSync(join(temporary,'existing-instance'));
  const existing=new DatabaseSync(process.env.DATABASE_PATH);existing.exec('CREATE TABLE unrelated(id INTEGER);INSERT INTO unrelated VALUES(42)');existing.close();
  const before=readFileSync(process.env.DATABASE_PATH);
  assert.throws(()=>restoreRelease());assert.deepEqual(readFileSync(process.env.DATABASE_PATH),before);
  process.env.DEPLOYMENT_DIRECTORY=join(temporary,'missing-snapshot');process.env.RENDER='true';
  assert.throws(()=>checkRenderRelease(),'Render build must reject a missing snapshot');
  console.log('Rilascio conservativo verificato: richieste in corso, blocco scritture, cifratura, snapshot alterati, codici storici, documenti, ripristino, confronto, riapertura e nessuna sovrascrittura di dati esistenti.');
}finally{
  source?.close();restored?.close();process.chdir(originalDirectory);
  for(const [key,value] of Object.entries(originalEnvironment)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  rmSync(temporary,{recursive:true,force:true});
}
