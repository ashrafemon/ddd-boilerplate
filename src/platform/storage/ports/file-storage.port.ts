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
}
