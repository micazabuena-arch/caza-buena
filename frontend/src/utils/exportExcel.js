import * as XLSX from 'xlsx';

/** @typedef {{ label: string, key?: string, value?: (row: object) => unknown }} ExportColumn */

/**
 * @param {string} filename
 * @param {string} sheetName
 * @param {ExportColumn[]} columns
 * @param {object[]} rows
 */
export function downloadExcel(filename, sheetName, columns, rows) {
  const data = rows.map((row) => {
    const record = {};
    columns.forEach((col) => {
      const val =
        typeof col.value === 'function'
          ? col.value(row)
          : row[col.key];
      record[col.label] = val ?? '';
    });
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
