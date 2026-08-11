import { registerAs } from '@nestjs/config';
import { booleanEnv, numericEnv } from './env.util';

export type IStorageDriver = 's3';
export type IS3Config = {
  accessKey: string;
  secretKey: string;
  bucket: string;
  endpoint: string;
  region?: string;
  url?: string;
  pathStyle?: boolean;
  presignedUrlTtlSeconds: number;
};

/**
 * Object storage (S3/MinIO) bootstrap config. Used only until admin
 * settings are saved in the DB; those values override these at runtime.
 */
export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER ?? 's3',
  s3: {
    accessKey: process.env.S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? 'mukut-erp',
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
    pathStyle: booleanEnv('S3_PATH_STYLE', booleanEnv('S3_FORCE_PATH_STYLE', true)),
    url: process.env.S3_PUBLIC_BASE_URL ?? '',
    presignedUrlTtlSeconds: numericEnv('S3_PRESIGNED_URL_TTL_SECONDS', 900),
  },
}));
