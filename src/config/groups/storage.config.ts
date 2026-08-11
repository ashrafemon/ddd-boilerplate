import { z } from 'zod';
import { booleanFromString, numberFromString } from '../env-helpers';

/**
 * Storage client group — S3 credentials.
 */
export const storageConfigSchema = z.object({
  S3_ENABLED: booleanFromString(false),
  S3_BUCKET: z.string().default('erp-files'),
  S3_REGION: z.string().default('us-east-1'),
  S3_PRESIGNED_URL_TTL_SECONDS: numberFromString(900),
});

export type StorageConfig = z.infer<typeof storageConfigSchema>;
