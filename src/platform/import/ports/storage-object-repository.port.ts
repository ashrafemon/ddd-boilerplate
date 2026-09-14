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

  /**
   * A consumed upload slot becomes a referenced source: the presigned-upload
   * TTL (minutes) is replaced by the retention window (days) so the file the
   * job still points at can never expire mid-pipeline.
   */
  abstract markConsumed(id: string, expiresAt: Date): Promise<void>;

  /** Objects whose retention (or unused upload slot) has lapsed. */
  abstract findExpired(cutoff: Date, limit: number): Promise<StorageObjectRecord[]>;

  abstract deleteById(id: string): Promise<void>;
}
