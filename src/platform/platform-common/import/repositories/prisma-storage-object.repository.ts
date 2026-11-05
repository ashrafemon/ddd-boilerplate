import { Prisma } from '../../../generated/client';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';
import { StorageObjectPurpose, StorageObjectRecord, StorageScanStatus } from '../import.types';

@Injectable()
export class PrismaStorageObjectRepository implements StorageObjectRepositoryPort {
  private readonly logger = new Logger(PrismaStorageObjectRepository.name);

  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async createPending(input: {
    tenantId?: string;
    storageKey: string;
    purpose: StorageObjectPurpose;
    contentType?: string;
    expiresAt?: Date;
    scanStatus?: StorageScanStatus;
  }): Promise<StorageObjectRecord> {
    try {
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
      return StorageObjectMapper.toRecord(row);
    } catch (err) {
      // The idempotency-key header makes the presigned slot request replayable:
      // the same storageKey returns the row already there instead of erroring.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.txHost.tx.storageObject.findUnique({
          where: { storageKey: input.storageKey },
        });
        if (existing) {
          return StorageObjectMapper.toRecord(existing);
        }
      }
      throw err;
    }
  }

  async findById(id: string): Promise<StorageObjectRecord | null> {
    const row = await this.txHost.tx.storageObject.findUnique({ where: { id } });
    return row ? StorageObjectMapper.toRecord(row) : null;
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
    return StorageObjectMapper.toRecord(row);
  }

  async markConsumed(id: string, expiresAt: Date): Promise<void> {
    const updated = await this.txHost.tx.storageObject.updateMany({
      where: { id },
      data: { expiresAt },
    });
    if (updated.count === 0) {
      this.logger.warn(`markConsumed: storage object ${id} no longer exists`);
    }
  }

  async findExpired(cutoff: Date, limit: number): Promise<StorageObjectRecord[]> {
    // Only unreferenced objects are purgeable: ImportJob's FK to storage_objects
    // is Restrict, so referenced sources stay as the audit trail.
    const rows = await this.txHost.tx.storageObject.findMany({
      where: {
        expiresAt: { lt: cutoff },
        importJobsAsSource: { none: {} },
        importJobsAsErrorReport: { none: {} },
      },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map(row => StorageObjectMapper.toRecord(row));
  }

  async deleteById(id: string): Promise<void> {
    await this.txHost.tx.storageObject.deleteMany({ where: { id } });
  }
}

export class StorageObjectMapper {
  static toRecord(row: {
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
}
