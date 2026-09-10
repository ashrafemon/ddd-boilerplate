import { Injectable } from '@nestjs/common';
import { ImportHandler } from '@platform/import/ports/import-handler.port';
import {
  ImportDescriptor,
  PreloadedReferences,
  RowResult,
  RowVerdict,
} from '@platform/import/import.types';
import { CreateVendorUseCase } from '../../../application/usecases/create-vendor.usecase';

export const VENDOR_IMPORT_DESCRIPTOR: ImportDescriptor = {
  entityKey: 'vendor',
  version: 1,
  fields: [
    {
      targetField: 'code',
      dataType: 'string',
      required: true,
      aliases: ['Vendor Code', 'vendor_code', 'Code'],
      i18nKey: 'vendor.code',
      maxLength: 64,
    },
    {
      targetField: 'name',
      dataType: 'string',
      required: true,
      aliases: ['Vendor Name', 'vendor_name', 'Name'],
      i18nKey: 'vendor.name',
      maxLength: 255,
    },
    {
      targetField: 'email',
      dataType: 'string',
      required: false,
      aliases: ['Email', 'e-mail'],
      i18nKey: 'vendor.email',
      maxLength: 255,
    },
    {
      targetField: 'phone',
      dataType: 'string',
      required: false,
      aliases: ['Phone', 'Tel'],
      i18nKey: 'vendor.phone',
      maxLength: 64,
    },
    {
      targetField: 'address',
      dataType: 'string',
      required: false,
      aliases: ['Address'],
      i18nKey: 'vendor.address',
      maxLength: 512,
    },
  ],
  upsertKeys: [['code']],
  maxRows: 10_000,
  maxFileSizeBytes: 10 * 1024 * 1024,
  executionChunkSize: 100,
};

type VendorImportRow = {
  rowNumber: number;
  code?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

/**
 * Thin import handler — validates mapped rows and delegates creation to the
 * existing CreateVendorUseCase (one transaction per row, owned by the module).
 */
@Injectable()
export class VendorImportHandler implements ImportHandler<VendorImportRow> {
  constructor(private readonly createVendor: CreateVendorUseCase) {}

  preloadReferences(): Promise<PreloadedReferences> {
    return Promise.resolve({});
  }

  validateBatch(rows: VendorImportRow[]): Promise<RowVerdict[]> {
    return Promise.resolve(
      rows.map(row => {
        const errors: string[] = [];
        if (!row.code?.trim()) errors.push('code is required');
        if (!row.name?.trim()) errors.push('name is required');
        if (row.email && !row.email.includes('@')) errors.push('email is invalid');
        return {
          rowNumber: row.rowNumber,
          status: errors.length ? 'INVALID' : 'VALID',
          errors: errors.length ? errors : undefined,
        };
      }),
    );
  }

  async executeBatch(rows: VendorImportRow[]): Promise<RowResult[]> {
    const results: RowResult[] = [];
    for (const row of rows) {
      try {
        const id = await this.createVendor.execute({
          code: String(row.code).trim(),
          name: String(row.name).trim(),
          email: row.email?.trim() || undefined,
          phone: row.phone?.trim() || undefined,
          address: row.address?.trim() || undefined,
        });
        results.push({
          rowNumber: row.rowNumber,
          status: 'APPLIED',
          entityId: id.toString(),
        });
      } catch (err) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }
}
