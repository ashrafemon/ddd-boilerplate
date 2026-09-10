import { detectHeaderRow, suggestMapping, structuralValidateRow } from './import-file.parser';
import { ImportDescriptor } from './import.types';

describe('import-file.parser', () => {
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
      },
      {
        targetField: 'name',
        dataType: 'string',
        required: true,
        aliases: ['Vendor Name'],
        i18nKey: 'vendor.name',
      },
    ],
    upsertKeys: [['code']],
    maxRows: 1000,
    maxFileSizeBytes: 1_000_000,
    executionChunkSize: 50,
  };

  it('skips title rows when detecting headers', () => {
    const matrix = [
      ['Vendor Import Template', '', ''],
      ['', '', ''],
      ['Vendor Code', 'Vendor Name', 'Email'],
      ['V-1', 'Acme', 'a@x.com'],
    ];
    expect(detectHeaderRow(matrix)).toBe(2);
  });

  it('suggests mapping from aliases', () => {
    const mapping = suggestMapping(['Vendor Code', 'Vendor Name'], descriptor);
    expect(mapping['Vendor Code']).toBe('code');
    expect(mapping['Vendor Name']).toBe('name');
  });

  it('flags missing required fields', () => {
    const errors = structuralValidateRow({ code: '' }, descriptor);
    expect(errors.some(e => e.includes('code'))).toBe(true);
  });
});
