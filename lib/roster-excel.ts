import ExcelJS from "exceljs";
import { stores, storeIds, timeLabel, type SlotAvailability } from "./registration";
import { buildRoster, coverageState, slotKey, type RosterVolunteer } from "./shift-roster";

const colors = { full: "FF395E14", empty: "FFF68B1F", partial: "FFFFFFFF" };

export async function rosterExcel(registrations: RosterVolunteer[], slots: SlotAvailability[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colletta Alimentare 2026";
  workbook.created = new Date();
  const roster = buildRoster(registrations);

  for (const store of storeIds) {
    const venue = stores[store];
    const sheet = workbook.addWorksheet([venue.name, venue.address].filter(Boolean).join(" "), {
      views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const columns = Math.max(1, ...venue.hours.map(hour => roster.get(slotKey({ store, hour }))?.length || 0));
    sheet.columns = [{ header: "Orario", width: 19 }, ...Array.from({ length: columns }, (_, i) => ({ header: `Volontario ${i + 1}`, width: 30 }))];
    sheet.getRow(1).height = 27;
    sheet.getRow(1).eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.full } };
      cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });

    for (const hour of venue.hours) {
      const people = roster.get(slotKey({ store, hour })) || [];
      const slot = slots.find(s => s.store === store && s.hour === hour);
      const state = coverageState({ store, hour, capacity: slot?.capacity ?? null, booked: people.length });
      const row = sheet.addRow([`${timeLabel(hour)}–${timeLabel(hour + 1)}`, ...Array.from({ length: columns }, (_, i) => people[i] ? `${people[i].firstName} ${people[i].lastName}` : "")]);
      row.height = Math.max(36, ...people.map(person => 16 * (Math.ceil(`${person.firstName} ${person.lastName}`.length / 26) + 1)));
      row.eachCell((cell, column) => {
        cell.font = { name: "Calibri", size: 12, color: { argb: column !== 1 && state === "full" ? "FFFFFFFF" : "FF222222" } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: column === 1 ? "FFFFFFFF" : colors[state] } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFD4D9CD" } } };
      });
    }
    sheet.pageSetup.printTitlesRow = "1:1";
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(columns + 1).letter}${sheet.rowCount}`;
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
