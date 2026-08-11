import { z } from 'zod';
import { appConfigSchema } from './groups/app.config';
import { awsConfigSchema } from './groups/aws.config';
import { cacheConfigSchema } from './groups/cache.config';
import { databaseConfigSchema } from './groups/database.config';
import { messagingConfigSchema } from './groups/messaging.config';
import { notificationConfigSchema } from './groups/notification.config';
import { observabilityConfigSchema } from './groups/observability.config';
import { platformConfigSchema } from './groups/platform.config';
import { storageConfigSchema } from './groups/storage.config';

/**
 * The environment schema is assembled from per-client configuration groups.
 * Each group owns the credentials of one client type (database, cache,
 * messaging, notification, storage, observability) plus the application and
 * platform groups.
 */
export const EnvSchema = z.object({
  ...appConfigSchema.shape,
  ...databaseConfigSchema.shape,
  ...awsConfigSchema.shape,
  ...cacheConfigSchema.shape,
  ...messagingConfigSchema.shape,
  ...notificationConfigSchema.shape,
  ...storageConfigSchema.shape,
  ...observabilityConfigSchema.shape,
  ...platformConfigSchema.shape,
});

/**
 * Validation callback for `ConfigModule.forRoot({ validate })`. Throws a
 * descriptive error listing every invalid environment variable at bootstrap
 * instead of failing deep inside the application later.
 */
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data as unknown as Record<string, unknown>;
}

export type AppEnv = z.infer<typeof EnvSchema>;
