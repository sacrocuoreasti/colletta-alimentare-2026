// Verify the authorized production deployment against its private pre-deploy backup, then reopen writes.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

const base='https://colletta-alimentare-2026.onrender.com';
const backup=process.env.BACKUP_PATH;
const revision=process.env.RELEASE_EXPECTED_REVISION;
if(!backup||!revision||!(/^[a-f0-9]{40}$/.test(revision)))throw new Error('Specificare BACKUP_PATH e RELEASE_EXPECTED_REVISION per questo rilascio.');
const manifest=JSON.parse(await readFile('.deployment/manifest.json','utf8'));
const expected=JSON.parse(await readFile(join(backup,'registrations.json'),'utf8'));
const slots=JSON.parse(await readFile(join(backup,'slots.json'),'utf8'));
const documents=JSON.parse(await readFile(join(backup,'documents-manifest.json'),'utf8'));
let cookie;
async function request(path,body){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Verifica interrotta: ${path}, HTTP ${response.status}. Nessuna riapertura forzata.`);
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  return response;
}
const health=await (await request('/api/health')).json();
if(health.revision!==revision||health.releaseId!==manifest.releaseId||health.version!==manifest.targetVersion||!health.maintenance)throw new Error('Il servizio non è il nuovo rilascio atteso in manutenzione.');
const login=await (await request('/api/accesso',{code:process.env.COLLETTA_ADMIN_CODE||'ColSC26'})).json();
if(login.role!=='admin')throw new Error('Accesso amministrativo richiesto.');
async function checkRecords(){
  const current=await (await request('/api/admin/iscrizioni')).json();
  if(!isDeepStrictEqual(current.registrations,expected)||!isDeepStrictEqual(current.slots,slots))throw new Error('Iscrizioni o capienze non coincidono con il backup: manutenzione mantenuta.');
}
async function checkDocuments(){
  for(const document of documents){
    const response=await request(`/api/admin/iscrizioni/${document.registrationId}/autorizzazione?index=${document.index}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length!==document.size||createHash('sha256').update(bytes).digest('hex')!==document.sha256)throw new Error('Un documento non coincide con il backup: manutenzione mantenuta.');
  }
}
await checkRecords();await checkDocuments();
const workbook=new ExcelJS.Workbook();
await workbook.xlsx.load(Buffer.from(await (await request('/api/admin/turni/excel')).arrayBuffer()));
let assignments=0;
if(workbook.worksheets.length!==3)throw new Error('Fogli Excel mancanti.');
for(const [index,store] of ['despar','penny','oratorio'].entries()){
  const sheet=workbook.worksheets[index],hours=slots.filter(s=>s.store===store).map(s=>s.hour);
  if(sheet.rowCount!==hours.length+1)throw new Error('Orari Excel non corrispondenti.');
  for(const [offset,hour] of hours.entries()){
    const names=expected.filter(r=>r.shifts.some(s=>s.store===store&&s.hour===hour)).map(r=>`${r.firstName} ${r.lastName}`).sort();
    const exported=sheet.getRow(offset+2).values.slice(2).filter(Boolean).sort();
    if(!isDeepStrictEqual(names,exported))throw new Error('Assegnazioni Excel non corrispondenti.');
    assignments+=names.length;
  }
}
await checkRecords();
const result=await (await request('/api/admin/release/complete',{})).json();
if(!result.matches||result.releaseId!==manifest.releaseId)throw new Error('Confronto finale non riuscito.');
const finalHealth=await (await request('/api/health')).json();
if(finalHealth.maintenance||finalHealth.revision!==revision)throw new Error('Riapertura non confermata.');
await checkRecords();await checkDocuments();
console.log(JSON.stringify({live:true,version:health.version,revision,registrations:expected.length,documents:documents.length,shiftAssignments:assignments,allFieldsAndHashesVerified:true,maintenance:false}));
