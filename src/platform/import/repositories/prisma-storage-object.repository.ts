import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';
import { StorageObjectPurpose, StorageObjectRecord, StorageScanStatus } from '../import.types';

@Injectable()
export class PrismaStorageObjectRepository implements StorageObjectRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async createPending(input: {
    tenantId?: string;
    storageKey: string;
    purpose: StorageObjectPurpose;
    contentType?: string;
    expiresAt?: Date;
    scanStatus?: StorageScanStatus;
  }): Promise<StorageObjectRecord> {
    const row = await this.txHost.tx.storageObject.create({
      data: {
        tenantId: input.tenantId ?? null,
        storageKey: input.storageKey,
        purpose: input.purpose,
        contentType: input.contentType ?? null,
        expiresAt: input.expiresAt ?? null,
        scanStatus: input.scanStatus ?? 'PENDING',
      },
    });
    return mapStorage(row);
  }

  async findById(id: string): Promise<StorageObjectRecord | null> {
    const row = await this.txHost.tx.storageObject.findUnique({ where: { id } });
    return row ? mapStorage(row) : null;
  }

  async markVerified(
    id: string,
    input: {
      sizeBytes: number;
      contentType?: string;
      checksum?: string;
      scanStatus: StorageScanStatus;
    },
  ): Promise<StorageObjectRecord> {
    const row = await this.txHost.tx.storageObject.update({
      where: { id },
      data: {
        sizeBytes: input.sizeBytes,
        contentType: input.contentType ?? undefined,
        checksum: input.checksum ?? undefined,
        scanStatus: input.scanStatus,
      },
    });
    return mapStorage(row);
  }
}

function mapStorage(row: {
  id: string;
  tenantId: string | null;
  storageKey: string;
  purpose: StorageObjectPurpose;
  contentType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  scanStatus: StorageScanStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StorageObjectRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? undefined,
    storageKey: row.storageKey,
    purpose: row.purpose,
    contentType: row.contentType ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    checksum: row.checksum ?? undefined,
    scanStatus: row.scanStatus,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
