import { registerAs } from '@nestjs/config';

/**
 * Object storage (S3/MinIO) bootstrap config. Used only until admin
 * settings are saved in the DB; those values override these at runtime.
 */
export default registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT ?? '',
  region: process.env.S3_REGION ?? 'us-east-1',
  bucket: process.env.S3_BUCKET ?? 'deyalpost',
  accessKey: process.env.S3_ACCESS_KEY ?? '',
  secretKey: process.env.S3_SECRET_KEY ?? '',
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
}));
