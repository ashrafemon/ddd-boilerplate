import * as XLSX from 'xlsx';
import { ColumnMapping, ImportDescriptor } from './import.types';

export interface ParsedSpreadsheet {
  sheets: string[];
  activeSheet: string;
  headerRowIndex: number;
  headers: string[];
  /** 1-based spreadsheet row numbers → raw objects keyed by header */
  rows: Array<{ rowNumber: number; values: Record<string, unknown> }>;
}

/**
 * Detect header row: first row with >= 2 non-empty cells that look like labels
 * (not mostly numeric). Falls back to row 0.
 */
export function detectHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 30);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    const cells = row.map(c => asText(c).trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const numericish = cells.filter(c => /^-?\d+(\.\d+)?$/.test(c)).length;
    if (numericish / cells.length < 0.5) {
      return i;
    }
  }
  return 0;
}

export function suggestMapping(headers: string[], descriptor: ImportDescriptor): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  for (const field of descriptor.fields) {
    const candidates = [field.targetField, field.i18nKey, ...field.aliases].map(normalize);
    const match = headers.find(h => candidates.includes(normalize(h)));
    if (match) {
      mapping[match] = field.targetField;
    }
  }
  return mapping;
}

export function applyMapping(
  raw: Record<string, unknown>,
  mapping: ColumnMapping,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (source in raw) {
      out[target] = raw[source];
    }
  }
  return out;
}

export function structuralValidateRow(
  mapped: Record<string, unknown>,
  descriptor: ImportDescriptor,
): string[] {
  const errors: string[] = [];
  for (const field of descriptor.fields) {
    const value = mapped[field.targetField];
    const empty = value === undefined || value === null || asText(value).trim() === '';
    if (field.required && empty) {
      errors.push(`${field.targetField} is required`);
      continue;
    }
    if (empty) continue;
    const str = asText(value);
    if (field.maxLength && str.length > field.maxLength) {
      errors.push(`${field.targetField} exceeds maxLength ${field.maxLength}`);
    }
    if (field.enumValues && field.enumValues.length > 0 && !field.enumValues.includes(str)) {
      errors.push(`${field.targetField} must be one of: ${field.enumValues.join(', ')}`);
    }
  }
  return errors;
}

export function parseSpreadsheetBuffer(buffer: Buffer, maxRows: number): ParsedSpreadsheet {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = workbook.SheetNames;
  const activeSheet = sheets[0] ?? 'Sheet1';
  const sheet = workbook.Sheets[activeSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const headerRowIndex = detectHeaderRow(matrix);
  const headerCells = (matrix[headerRowIndex] ?? []).map(c => asText(c).trim());
  const headers = headerCells.filter(Boolean);

  const rows: ParsedSpreadsheet['rows'] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    if (rows.length >= maxRows) break;
    const line = matrix[i] ?? [];
    const values: Record<string, unknown> = {};
    let nonEmpty = 0;
    for (let c = 0; c < headerCells.length; c++) {
      const key = headerCells[c];
      if (!key) continue;
      const cell = line[c];
      const text = asText(cell).trim();
      if (text) nonEmpty += 1;
      values[key] = text;
    }
    if (nonEmpty === 0) continue;
    rows.push({ rowNumber: i + 1, values });
  }

  return { sheets, activeSheet, headerRowIndex, headers, rows };
}

export function parseCsvBuffer(buffer: Buffer, maxRows: number): ParsedSpreadsheet {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const matrix = lines.map(line => splitCsvLine(line));
  const headerRowIndex = detectHeaderRow(matrix);
  const headerCells = (matrix[headerRowIndex] ?? []).map(c => asText(c).trim());
  const headers = headerCells.filter(Boolean);
  const rows: ParsedSpreadsheet['rows'] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    if (rows.length >= maxRows) break;
    const line = matrix[i] ?? [];
    const values: Record<string, unknown> = {};
    let nonEmpty = 0;
    for (let c = 0; c < headerCells.length; c++) {
      const key = headerCells[c];
      if (!key) continue;
      const text = String(line[c] ?? '').trim();
      if (text) nonEmpty += 1;
      values[key] = text;
    }
    if (nonEmpty === 0) continue;
    rows.push({ rowNumber: i + 1, values });
  }
  return {
    sheets: ['Sheet1'],
    activeSheet: 'Sheet1',
    headerRowIndex,
    headers,
    rows,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseImportFile(
  buffer: Buffer,
  contentType: string | undefined,
  fileNameHint: string | undefined,
  maxRows: number,
): ParsedSpreadsheet {
  const lower = `${contentType ?? ''} ${fileNameHint ?? ''}`.toLowerCase();
  if (lower.includes('csv') || lower.endsWith('.csv')) {
    return parseCsvBuffer(buffer, maxRows);
  }
  return parseSpreadsheetBuffer(buffer, maxRows);
}

/** Stringify an arbitrary cell value without leaking '[object Object]'. */
function asText(value: unknown): string {
  if (value === undefined || value === null) return '';
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return value.toString();
    case 'object':
      return JSON.stringify(value);
    default:
      return '';
  }
}
