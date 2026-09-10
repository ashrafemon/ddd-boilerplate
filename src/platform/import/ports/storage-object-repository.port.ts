import { StorageObjectPurpose, StorageObjectRecord, StorageScanStatus } from '../import.types';

export abstract class StorageObjectRepositoryPort {
  abstract createPending(input: {
    tenantId?: string;
    storageKey: string;
    purpose: StorageObjectPurpose;
    contentType?: string;
    expiresAt?: Date;
    scanStatus?: StorageScanStatus;
  }): Promise<StorageObjectRecord>;

  abstract findById(id: string): Promise<StorageObjectRecord | null>;

  abstract markVerified(
    id: string,
    input: {
      sizeBytes: number;
      contentType?: string;
      checksum?: string;
      scanStatus: StorageScanStatus;
    },
  ): Promise<StorageObjectRecord>;
}
