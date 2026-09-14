import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ColumnMapping, ImportDescriptor } from './import.types';

export interface ParsedSpreadsheet {
  sheets: string[];
  activeSheet: string;
  headerRowIndex: number;
  headers: string[];
  /** 1-based spreadsheet row numbers → raw objects keyed by header */
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
}

/**
 * Spreadsheet/CSV parsing service (xlsx). Cell values are normalized to text
 * at this single boundary — downstream code never sees raw cell objects.
 */
@Injectable()
export class ImportFileParser {
  parseFile(
    buffer: Buffer,
    contentType: string | undefined,
    fileNameHint: string | undefined,
    maxRows: number,
  ): ParsedSpreadsheet {
    const lower = `${contentType ?? ''} ${fileNameHint ?? ''}`.toLowerCase();
    if (lower.includes('csv') || lower.endsWith('.csv')) {
      return this.parseCsv(buffer, maxRows);
    }
    return this.parseSpreadsheet(buffer, maxRows);
  }

  parseSpreadsheet(buffer: Buffer, maxRows: number): ParsedSpreadsheet {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheets = workbook.SheetNames;
    const activeSheet = sheets[0] ?? 'Sheet1';
    const sheet = workbook.Sheets[activeSheet];
    // Cell budget BEFORE sheet_to_json: a small compressed workbook can
    // declare enormous !ref dimensions (zip bomb) and `sheet_to_json` would
    // materialise all of it into memory before the row cap ever applies.
    const ref = sheet?.['!ref'];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      const declaredRows = range.e.r + 1;
      const declaredCols = range.e.c + 1;
      const maxCols = 256;
      if (declaredRows > maxRows + 2 || declaredCols > maxCols) {
        throw new BadRequestException(
          `Spreadsheet declares a ${declaredRows}x${declaredCols} cell range, above the ` +
            `${maxRows + 2}x${maxCols} processing budget for this import`,
        );
      }
    }
    const matrix = this.toTextMatrix(
      XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }),
    );
    return this.materialize(sheets, activeSheet, matrix, maxRows);
  }

  parseCsv(buffer: Buffer, maxRows: number): ParsedSpreadsheet {
    const lines = buffer
      .toString('utf8')
      .split(/\r?\n/)
      .filter(l => l.length > 0);
    return this.materialize(
      ['Sheet1'],
      'Sheet1',
      lines.map(l => this.splitCsvLine(l)),
      maxRows,
    );
  }

  /**
   * Detect header row: first row with >= 2 non-empty cells that look like
   * labels (not mostly numeric). Falls back to row 0.
   */
  detectHeaderRow(matrix: string[][]): number {
    const limit = Math.min(matrix.length, 30);
    for (let i = 0; i < limit; i++) {
      const cells = (matrix[i] ?? []).map(c => c.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      const numericish = cells.filter(c => /^-?\d+(\.\d+)?$/.test(c)).length;
      if (numericish / cells.length < 0.5) {
        return i;
      }
    }
    return 0;
  }

  suggestMapping(headers: string[], descriptor: ImportDescriptor): ColumnMapping {
    const mapping: ColumnMapping = {};
    for (const field of descriptor.fields) {
      const candidates = [field.targetField, field.i18nKey, ...field.aliases].map(header =>
        ImportFileParser.normalizeHeader(header),
      );
      const match = headers.find(h => candidates.includes(ImportFileParser.normalizeHeader(h)));
      if (match) {
        mapping[match] = field.targetField;
      }
    }
    return mapping;
  }

  applyMapping(raw: Record<string, string>, mapping: ColumnMapping): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [source, target] of Object.entries(mapping)) {
      if (source in raw) {
        out[target] = raw[source];
      }
    }
    return out;
  }

  structuralValidateRow(mapped: Record<string, string>, descriptor: ImportDescriptor): string[] {
    const errors: string[] = [];
    for (const field of descriptor.fields) {
      const value = mapped[field.targetField];
      const empty = value === undefined || value.trim() === '';
      if (field.required && empty) {
        errors.push(`${field.targetField} is required`);
        continue;
      }
      if (empty) continue;
      if (field.maxLength && value.length > field.maxLength) {
        errors.push(`${field.targetField} exceeds maxLength ${field.maxLength}`);
      }
      if (field.enumValues && field.enumValues.length > 0 && !field.enumValues.includes(value)) {
        errors.push(`${field.targetField} must be one of: ${field.enumValues.join(', ')}`);
      }
    }
    return errors;
  }

  private materialize(
    sheets: string[],
    activeSheet: string,
    matrix: string[][],
    maxRows: number,
  ): ParsedSpreadsheet {
    const headerRowIndex = this.detectHeaderRow(matrix);
    const headerCells = (matrix[headerRowIndex] ?? []).map(c => c.trim());
    const headers = headerCells.filter(Boolean);

    const rows: ParsedSpreadsheet['rows'] = [];
    for (let i = headerRowIndex + 1; i < matrix.length; i++) {
      if (rows.length >= maxRows) break;
      const line = matrix[i] ?? [];
      const values: Record<string, string> = {};
      let nonEmpty = 0;
      for (let c = 0; c < headerCells.length; c++) {
        const key = headerCells[c];
        if (!key) continue;
        const text = (line[c] ?? '').trim();
        if (text) nonEmpty += 1;
        values[key] = text;
      }
      if (nonEmpty === 0) continue;
      rows.push({ rowNumber: i + 1, values });
    }
    return { sheets, activeSheet, headerRowIndex, headers, rows };
  }

  private toTextMatrix(rows: unknown[][]): string[][] {
    return rows.map(row => row.map(cell => ImportFileParser.asText(cell)));
  }

  private splitCsvLine(line: string): string[] {
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

  private static normalizeHeader(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  /** Stringify an arbitrary cell value without leaking '[object Object]'. */
  private static asText(value: unknown): string {
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
}
