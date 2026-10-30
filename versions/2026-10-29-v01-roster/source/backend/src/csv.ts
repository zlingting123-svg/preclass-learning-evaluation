import { stringify } from 'csv-stringify/sync';

export function safeCsv(rows: unknown[][]): string {
  // The library handles quoting, BOM, records and formula escaping. Cover
  // whitespace-prefixed formulas too; never change the source database value.
  const text = rows.map(row => row.map(value => {
    const cell = String(value ?? '');
    return /^[\s\u0000-\u001f]+[=+@-]/u.test(cell) ? "'" + cell : cell;
  }));
  return stringify(text, { bom: true, quoted: true, escape_formulas: true, record_delimiter: '\r\n' });
}
