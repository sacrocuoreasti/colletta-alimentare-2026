// Synthetic fixtures only. Does not access the real database or uploaded documents.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const directory = await mkdtemp(join(tmpdir(), 'colletta-roster-test-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'lib/roster-excel.ts', 'components/coverage-table.tsx', '--outDir', directory, '--module', 'commonjs', '--target', 'ES2019', '--jsx', 'react-jsx', '--esModuleInterop', '--skipLibCheck', '--strict'], { stdio: 'inherit' });
  await writeFile(join(directory, 'package.json'), '{"type":"commonjs"}');
  await symlink(resolve('node_modules'), join(directory, 'node_modules'));
  const require = createRequire(join(directory, 'test.cjs'));
  const { rosterExcel } = require('./lib/roster-excel.js');
  const { CoverageTable } = require('./components/coverage-table.js');
  const records = [
    { id: '1', firstName: 'Zoë', lastName: 'Verdi', shifts: [{ store: 'despar', hour: 8 }, { store: 'oratorio', hour: 15 }] },
    { id: '2', firstName: 'Anna', lastName: 'Bianchi', shifts: [{ store: 'despar', hour: 8 }, { store: 'penny', hour: 9 }] },
    { id: '3', firstName: 'Anna', lastName: 'Bianchi', shifts: [{ store: 'despar', hour: 8 }] },
    { id: '4', firstName: '=1+1', lastName: 'D’Àngelo & <Test>', shifts: [{ store: 'penny', hour: 10 }] },
  ];
  const slots = ['despar', 'penny', 'oratorio'].flatMap(store => (store === 'oratorio' ? [15, 16, 17, 18] : Array.from({ length: 12 }, (_, i) => i + 8)).map(hour => ({ store, hour, capacity: store === 'despar' && hour === 8 ? 3 : store === 'penny' && hour === 9 ? 4 : store === 'oratorio' && hour === 16 ? 0 : null, booked: records.filter(r => r.shifts.some(s => s.store === store && s.hour === hour)).length })));
  const original = JSON.stringify({ records, slots });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await rosterExcel(records, slots));
  assert.deepEqual(workbook.worksheets.map(s => s.name), ['Despar Corso Alba', 'Penny Corso Venezia', 'Oratorio']);
  assert.deepEqual(workbook.worksheets.map(s => s.rowCount), [13, 13, 5]);
  const despar = workbook.worksheets[0];
  assert.deepEqual(despar.getRow(2).values.slice(1), ['08:00–09:00', 'Anna Bianchi', 'Anna Bianchi', 'Zoë Verdi']);
  assert.equal(despar.getCell('B2').fill.fgColor.argb, 'FF395E14');
  assert.equal(despar.getCell('B3').fill.fgColor.argb, 'FFF68B1F');
  const penny = workbook.worksheets[1];
  assert.equal(penny.getCell('B3').value, 'Anna Bianchi');
  assert.equal(penny.getCell('B3').fill.fgColor.argb, 'FFFFFFFF');
  assert.equal(penny.getCell('B4').value, '=1+1 D’Àngelo & <Test>');
  assert.equal(penny.getCell('B4').type, ExcelJS.ValueType.String, 'Names must be text, never formulas');
  assert.equal(workbook.worksheets[2].getCell('A2').value, '15:00–16:00');
  assert.equal(workbook.worksheets[2].getCell('A5').value, '18:00–19:00');
  for (const sheet of workbook.worksheets) {
    assert.equal(sheet.getCell('A1').value, 'Orario');
    assert.equal(sheet.views[0].xSplit, 1);
    assert.equal(sheet.views[0].ySplit, 1);
    assert.equal(sheet.pageSetup.orientation, 'landscape');
  }
  const html = renderToStaticMarkup(React.createElement(CoverageTable, { slots, registrations: records }));
  assert(html.includes('Turni nominativi'));
  assert.equal((html.match(/<li>Anna Bianchi<\/li>/g) || []).length, 3, 'Preserve same-name volunteers and each shift assignment');
  assert(html.includes('D’Àngelo &amp; &lt;Test&gt;'));
  assert.match(html, /coverage-cell full[\s\S]*?<li>Anna Bianchi<\/li>/);
  assert(html.includes('coverage-cell empty'));
  assert(html.includes('coverage-cell partial'));
  assert(html.includes('unavailable-cell'));
  assert(!html.includes('<strong>3/3</strong>'));
  const coverage = renderToStaticMarkup(React.createElement(CoverageTable, { slots }));
  assert(coverage.includes('<strong>3/3</strong>'));
  assert(!coverage.includes('Zoë Verdi'));
  const empty = new ExcelJS.Workbook();
  await empty.xlsx.load(await rosterExcel([], slots.map(s => ({ ...s, booked: 0 }))));
  assert.equal(empty.worksheets.length, 3);
  assert.deepEqual(empty.worksheets.map(s => s.columnCount), [2, 2, 2]);
  assert.equal(JSON.stringify({ records, slots }), original, 'Rendering and exporting must not mutate source data');
  console.log('Vista nominativa ed Excel verificati: orari per sede, omonimi, ordinamento, accenti, testo sicuro, colori, elenco vuoto e dati invariati.');
} finally { await rm(directory, { recursive: true, force: true }); }
