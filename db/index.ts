import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { registrationSchema, stores, storeIds, type Shift } from "../lib/registration";

export type Registration = z.infer<typeof registrationSchema>;
type Row = { id: string; first_name: string; last_name: string; phone: string; email: string|null; shifts: string; is_minor: number; access_code: string|null; file_key: string|null; file_name: string|null; file_type: string|null; files_json: string|null; uploaded_at: string|null; created_at: string };
export type RecordView = Registration & { accessCode: string|null; hasAuthorization: boolean; fileName: string|null; authorizationFiles: {name:string;type:string}[]; uploadedAt: string|null; createdAt: string };
export type Slot = Shift & { capacity: number|null; booked: number };
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
let database: DatabaseSync | undefined;
const databasePath = () => resolve(process.env.DATABASE_PATH || "data/colletta.sqlite");
export function getDatabase() {
  if (database) return database;
  mkdirSync(dirname(databasePath()), { recursive: true });
  const db = new DatabaseSync(databasePath());
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS registrations (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, shifts TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  db.exec("BEGIN IMMEDIATE");
  try {
    const columns = new Set((db.prepare("PRAGMA table_info(registrations)").all() as {name:string}[]).map(c=>c.name));
    for (const [name,type] of Object.entries({is_minor:"INTEGER NOT NULL DEFAULT 0", access_code:"TEXT",file_key:"TEXT",file_name:"TEXT",file_type:"TEXT",files_json:"TEXT",uploaded_at:"TEXT"})) {
      if (!columns.has(name)) db.exec(`ALTER TABLE registrations ADD COLUMN ${name} ${type}`);
    }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS registration_code ON registrations(access_code) WHERE access_code IS NOT NULL;
      CREATE TABLE IF NOT EXISTS issued_codes (code TEXT PRIMARY KEY);
      INSERT OR IGNORE INTO issued_codes(code) SELECT access_code FROM registrations WHERE access_code IS NOT NULL;
      CREATE TABLE IF NOT EXISTS slot_limits (store TEXT NOT NULL, hour INTEGER NOT NULL, capacity INTEGER, PRIMARY KEY(store,hour));
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, registration_id TEXT, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL); COMMIT;`);
  } catch(e) { db.exec("ROLLBACK"); db.close(); throw e; }
  database = db;
  return db;
}
function transaction<T>(fn:()=>T):T {
  const db=getDatabase(); db.exec("BEGIN IMMEDIATE");
  try { const result=fn(); db.exec("COMMIT"); return result; } catch(e) { db.exec("ROLLBACK"); throw e; }
}
function row(id: string) { return getDatabase().prepare("SELECT * FROM registrations WHERE id=?").get(id) as Row|undefined; }
function view(r:Row):RecordView { return {id:r.id,firstName:r.first_name,lastName:r.last_name,phone:r.phone,email:r.email||"",shifts:JSON.parse(r.shifts),isMinor:!!r.is_minor,accessCode:r.access_code,hasAuthorization:!!r.file_key,fileName:r.file_name,authorizationFiles:storedFiles(r).map(({name,type})=>({name,type})),uploadedAt:r.uploaded_at,createdAt:r.created_at}; }
export function listRegistrations() { return (getDatabase().prepare("SELECT * FROM registrations ORDER BY created_at DESC, id").all() as Row[]).map(view); }
function booked(store:string,hour:number,except="") {
  return Number((getDatabase().prepare(`SELECT COUNT(*) AS total FROM registrations r, json_each(r.shifts) s WHERE r.id<>? AND json_extract(s.value,'$.store')=? AND json_extract(s.value,'$.hour')=?`).get(except,store,hour) as {total:number}).total);
}
export function listSlots():Slot[] {
  const db=getDatabase();
  return storeIds.flatMap(store=>stores[store].hours.map(hour=>{
    const limit=db.prepare("SELECT capacity FROM slot_limits WHERE store=? AND hour=?").get(store,hour) as {capacity:number|null}|undefined;
    return {store:store as Shift["store"],hour,capacity:limit?.capacity??null,booked:booked(store,hour)};
  }));
}
function checkCapacity(shifts:Shift[],except="") {
  for(const s of shifts) {
    const limit=getDatabase().prepare("SELECT capacity FROM slot_limits WHERE store=? AND hour=?").get(s.store,s.hour) as {capacity:number|null}|undefined;
    if(limit?.capacity!=null && booked(s.store,s.hour,except)>=limit.capacity) throw new AppError(`Il turno ${stores[s.store].name} ${s.hour}:00–${s.hour+1}:00 è completo. Scegli un’altra fascia.`,409);
  }
}
function makeCode() {
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for(let i=0;i<1000;i++) {
    const code=Array.from({length:3},()=>alphabet[randomInt(alphabet.length)]).join("");
    if(getDatabase().prepare("INSERT OR IGNORE INTO issued_codes(code) VALUES (?)").run(code).changes) return code;
  }
  throw new AppError("Non è stato possibile generare il codice. Riprova.",503);
}
export function saveRegistration(value:Registration) {
  return transaction(()=>{
    const db=getDatabase();const existing=row(value.id);
    if(existing) {
      const old=view(existing);
      if(["firstName","lastName","phone","email","isMinor","shifts"].some(key=>JSON.stringify(old[key as keyof Registration])!==JSON.stringify(value[key as keyof Registration]))) throw new AppError("Questa iscrizione è già stata inviata con dati diversi. Ricarica la pagina.",409);
      return old;
    }
    checkCapacity(value.shifts);
    const code=value.isMinor?makeCode():null;
    db.prepare("INSERT INTO registrations (id,first_name,last_name,phone,email,shifts,is_minor,access_code) VALUES (?,?,?,?,?,?,?,?)").run(value.id,value.firstName,value.lastName,value.phone,value.email||null,JSON.stringify(value.shifts),Number(value.isMinor),code);
    return view(row(value.id)!);
  });
}
export function updateRegistration(id:string,value:Registration) {
  let discard:StoredFile[]=[];
  const result=transaction(()=>{
    const current=row(id);if(!current)throw new AppError("Iscrizione non trovata.",404);
    checkCapacity(value.shifts,id);
    const code=value.isMinor?(current.access_code||makeCode()):null;
    getDatabase().prepare("UPDATE registrations SET first_name=?,last_name=?,phone=?,email=?,shifts=?,is_minor=?,access_code=? WHERE id=?").run(value.firstName,value.lastName,value.phone,value.email||null,JSON.stringify(value.shifts),Number(value.isMinor),code,id);
    if(!value.isMinor) {
      discard=storedFiles(current);
      getDatabase().prepare("UPDATE registrations SET file_key=NULL,file_name=NULL,file_type=NULL,files_json=NULL,uploaded_at=NULL WHERE id=?").run(id);
      getDatabase().prepare("DELETE FROM sessions WHERE registration_id=?").run(id);
    }
    return view(row(id)!);
  });
  discard.forEach(f=>removeFile(f.key));return result;
}
export function deleteRegistration(id:string) {
  const file=transaction(()=>{
    const current=row(id);if(!current)throw new AppError("Iscrizione non trovata.",404);
    getDatabase().prepare("DELETE FROM sessions WHERE registration_id=?").run(id);
    getDatabase().prepare("DELETE FROM registrations WHERE id=?").run(id);
    return storedFiles(current);
  });
  file.forEach(f=>removeFile(f.key));
}
export function setCapacities(limits: {store:Shift["store"];hour:number;capacity:number|null}[]) {
  transaction(()=>{
    for(const {store,hour,capacity} of limits) {
      if(capacity!=null && capacity<booked(store,hour))throw new AppError(`Il massimo per ${stores[store].name} ${hour}:00 non può essere inferiore agli iscritti presenti.`,409);
    }
    for(const {store,hour,capacity} of limits) getDatabase().prepare("INSERT INTO slot_limits(store,hour,capacity) VALUES(?,?,?) ON CONFLICT(store,hour) DO UPDATE SET capacity=excluded.capacity").run(store,hour,capacity);
  });
}
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
export function createSession(role:"admin"|"minor",registrationId:string|null=null) {
  const token=randomBytes(32).toString("hex");
  getDatabase().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  getDatabase().prepare("INSERT INTO sessions(token_hash,role,registration_id,expires) VALUES(?,?,?,?)").run(hash(token),role,registrationId,Date.now()+8*60*60*1000);
  return token;
}
export function sessionFromToken(token:string) {
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const session=getDatabase().prepare("SELECT role,registration_id FROM sessions WHERE token_hash=? AND expires>?").get(hash(token),Date.now()) as {role:"admin"|"minor";registration_id:string|null}|undefined;
  if(!session)return null;
  if(session.role==="minor" && (!session.registration_id || !row(session.registration_id)?.is_minor))return null;
  return session;
}
export function endSession(token:string) { getDatabase().prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token)); }
export function login(code:string,client:string) {
  const db=getDatabase();const key=hash(client);const now=Date.now();
  db.prepare("DELETE FROM login_attempts WHERE reset_at<?").run(now);
  const attempt=db.prepare("SELECT failures FROM login_attempts WHERE key=?").get(key) as {failures:number}|undefined;
  if((attempt?.failures??0)>=10)throw new AppError("Troppi tentativi. Riprova tra 15 minuti.",429);
  const admin=Buffer.from(process.env.ADMIN_CODE||"ColSC26");const input=Buffer.from(code);
  if(input.length===admin.length && timingSafeEqual(input,admin))return {role:"admin" as const, token:createSession("admin")};
  const minor=/^[A-Z0-9]{3}$/.test(code.toUpperCase()) ? db.prepare("SELECT id FROM registrations WHERE access_code=? AND is_minor=1").get(code.toUpperCase()) as {id:string}|undefined : undefined;
  if(minor)return {role:"minor" as const,token:createSession("minor",minor.id)};
  db.prepare("INSERT INTO login_attempts(key,failures,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=failures+1").run(key,now+15*60*1000);
  throw new AppError("Codice non valido. Controlla il codice ricevuto dopo l’iscrizione.",401);
}
const filePath=(key:string)=>resolve(dirname(databasePath()),"autorizzazioni",key);
function removeFile(key:string) { try{unlinkSync(filePath(key));}catch{} }
export function minorStatus(id:string) {
  const r=row(id);if(!r||!r.is_minor)throw new AppError("Iscrizione non trovata.",404);
  return {firstName:r.first_name,hasAuthorization:!!r.file_key,fileName:r.file_name,authorizationFiles:storedFiles(r).map(({name,type})=>({name,type})),uploadedAt:r.uploaded_at};
}
type StoredFile={key:string;name:string;type:string};
function storedFiles(r:Row):StoredFile[] {
  return r.files_json ? JSON.parse(r.files_json) : r.file_key ? [{key:r.file_key,name:r.file_name!,type:r.file_type!}] : [];
}
export function uploadAuthorization(id:string,files:{bytes:Buffer;name:string}[]) {
  const prepared=files.map(({bytes,name})=>{
    const pdf=bytes.subarray(0,5).toString()==="%PDF-";
    const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
    if(!pdf&&!jpg&&!png&&!webp)throw new AppError("Usa un PDF oppure due foto JPG, PNG o WebP.");
    const type=pdf?"application/pdf":jpg?"image/jpeg":png?"image/png":"image/webp";
    return {bytes,name:name.slice(0,180),type,key:`${randomUUID()}.${pdf?"pdf":jpg?"jpg":png?"png":"webp"}`};
  });
  if(!(prepared.length===1&&prepared[0].type==="application/pdf") && !(prepared.length===2&&prepared.every(f=>f.type.startsWith("image/"))))throw new AppError("Carica un PDF con entrambe le pagine oppure due foto, una per pagina.");
  const written:StoredFile[]=[];
  try {
    for(const file of prepared){mkdirSync(dirname(filePath(file.key)),{recursive:true});writeFileSync(filePath(file.key),file.bytes,{flag:"wx",mode:0o600});written.push(file);}
    const old=transaction(()=>{
      const r=row(id);if(!r||!r.is_minor)throw new AppError("Iscrizione non trovata.",404);
      const first=prepared[0];const metadata=prepared.map(({key,name,type})=>({key,name,type}));
      getDatabase().prepare("UPDATE registrations SET file_key=?,file_name=?,file_type=?,files_json=?,uploaded_at=CURRENT_TIMESTAMP WHERE id=?").run(first.key,first.name,first.type,JSON.stringify(metadata),id);
      return storedFiles(r);
    });
    old.forEach(f=>removeFile(f.key));
  } catch(e){written.forEach(f=>removeFile(f.key));throw e;}
}
export function authorizationFile(id:string,index=0) {
  const r=row(id);if(!r)throw new AppError("Iscrizione non trovata.",404);
  const files=storedFiles(r);
  if(!Number.isInteger(index)||index<0||index>=files.length)throw new AppError("Documento non trovato.",404);
  const file=files[index];return {bytes:readFileSync(filePath(file.key)),type:file.type,name:file.name};
}
