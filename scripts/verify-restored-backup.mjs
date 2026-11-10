// Run only against a separate local copy of a backup, never production or the original backup.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

const base = process.env.TEST_BASE_URL;
const backup = process.env.BACKUP_PATH;
if (!base || new URL(base).hostname !== '127.0.0.1' || !backup) throw new Error('Set TEST_BASE_URL to a local restore-test server and BACKUP_PATH to the original backup render/ directory.');
const expected = JSON.parse(await readFile(join(backup, 'registrations.json'), 'utf8'));
const slots = JSON.parse(await readFile(join(backup, 'slots.json'), 'utf8'));
const documents = JSON.parse(await readFile(join(backup, 'documents-manifest.json'), 'utf8'));
const login = await fetch(base + '/api/accesso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: process.env.TEST_ADMIN_CODE || 'ColSC26' }) });
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie').split(';')[0];
async function snapshot() {
  const response = await fetch(base + '/api/admin/iscrizioni', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  return response.json();
}
function check(data) {
  assert.deepEqual(data.registrations, expected, 'Every registration, shift, code, timestamp and document metadata must be preserved');
  assert.deepEqual(data.slots, slots, 'Capacities and coverage must be preserved');
}
check(await snapshot());
for (const document of documents) {
  const response = await fetch(base + `/api/admin/iscrizioni/${document.registrationId}/autorizzazione?index=${document.index}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, document.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), document.sha256);
}
const response = await fetch(base + '/api/admin/turni/excel', { headers: { Cookie: cookie } });
assert.equal(response.status, 200);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
let exportedAssignments = 0;
for (const [index, store] of ['despar', 'penny', 'oratorio'].entries()) {
  const hours = slots.filter(s => s.store === store).map(s => s.hour);
  const sheet = workbook.worksheets[index];
  assert.equal(sheet.rowCount, hours.length + 1);
  for (const [offset, hour] of hours.entries()) {
    const names = expected.filter(r => r.shifts.some(s => s.store === store && s.hour === hour)).map(r => `${r.firstName} ${r.lastName}`).sort();
    const exported = sheet.getRow(offset + 2).values.slice(2).filter(Boolean).sort();
    assert.deepEqual(exported, names);
    exportedAssignments += exported.length;
  }
}
check(await snapshot());
console.log(JSON.stringify({ restoredRegistrations: expected.length, restoredDocuments: documents.length, exportedAssignments, allFieldsAndHashesVerified: true, exportLeftDataUnchanged: true }));
