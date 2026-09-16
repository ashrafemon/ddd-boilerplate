import { ColumnMapping, ImportDescriptor } from './import.types';
import { ImportFileParser } from './import-file.parser';

const descriptor: ImportDescriptor = {
  entityKey: 'vendor',
  version: 1,
  fields: [
    {
      targetField: 'code',
      dataType: 'string',
      required: true,
      aliases: ['Vendor Code'],
      i18nKey: 'vendor.code',
      maxLength: 64,
    },
    {
      targetField: 'name',
      dataType: 'string',
      required: true,
      aliases: ['Name'],
      i18nKey: 'vendor.name',
    },
    {
      targetField: 'status',
      dataType: 'string',
      required: false,
      aliases: [],
      i18nKey: 'vendor.status',
      enumValues: ['ACTIVE', 'INACTIVE'],
    },
  ],
  upsertKeys: [['code']],
  maxRows: 1000,
  maxFileSizeBytes: 1024,
  executionChunkSize: 10,
};

describe('ImportFileParser', () => {
  const parser = new ImportFileParser();

  it('detects the header row past junk rows above it', () => {
    const matrix = [
      ['Report 2026', ''],
      ['1', '2'],
      ['Vendor Code', 'Name'],
      ['V1', 'Acme'],
    ];
    expect(parser.detectHeaderRow(matrix)).toBe(2);
  });

  it('suggests a mapping from headers and aliases (normalized)', () => {
    const mapping = parser.suggestMapping(['Vendor_Code', 'name'], descriptor);
    expect(mapping).toEqual({ Vendor_Code: 'code', name: 'name' });
  });

  it('applies mapping and structurally validates required + enum rules', () => {
    const mapping: ColumnMapping = { Code: 'code', Name: 'name', Status: 'status' };
    const mapped = parser.applyMapping(
      { Code: '', Name: 'Acme', Status: 'NOPE', Extra: 'x' },
      mapping,
    );
    expect(mapped).toEqual({ code: '', name: 'Acme', status: 'NOPE' });
    const errors = parser.structuralValidateRow(mapped, descriptor);
    expect(errors).toEqual(['code is required', 'status must be one of: ACTIVE, INACTIVE']);
  });

  it('parses a CSV buffer with quoted fields and skips empty rows', () => {
    const csv = 'Code,Name\nV1,"Acme, Inc"\n,\n';
    const parsed = parser.parseCsv(Buffer.from(csv, 'utf8'), 100);
    expect(parsed.headers).toEqual(['Code', 'Name']);
    expect(parsed.rows).toEqual([{ rowNumber: 2, values: { Code: 'V1', Name: 'Acme, Inc' } }]);
  });
});
