export interface FileUploadResult {
  key: string;
  url?: string;
  size: number;
  contentType?: string;
}

export interface FileDownloadResult {
  body: Buffer;
  contentType?: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType?: string;
}

export interface PresignedUpload {
  /** PUT when the disk only supports temporary URLs; POST when policy fields exist. */
  method: 'PUT' | 'POST';
  url: string;
  key: string;
  fields?: Record<string, string>;
  expiresAt: Date;
  maxBytes?: number;
  contentTypes?: string[];
}

/**
 * File storage abstraction (S3 by default). Business modules depend only on
 * this port.
 */
export abstract class FileStoragePort {
  public abstract upload(input: {
    key: string;
    body: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<FileUploadResult>;

  public abstract download(key: string): Promise<FileDownloadResult>;

  public abstract delete(key: string): Promise<void>;

  public abstract getMetadata(key: string): Promise<FileMetadata | null>;

  public abstract getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Browser-direct upload slot. Prefer POST+policy when available; PUT temporary
   * URL is an acceptable fallback for local disks.
   */
  public abstract createPresignedUpload(input: {
    key: string;
    expiresInSeconds: number;
    maxBytes?: number;
    contentTypes?: string[];
  }): Promise<PresignedUpload>;
}
