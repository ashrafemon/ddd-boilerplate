import { z } from 'zod';
import { booleanFromString } from '../env-helpers';

/**
 * Notification client group — SNS and SES credentials.
 */
export const notificationConfigSchema = z.object({
  SNS_ENABLED: booleanFromString(false),
  SNS_TOPIC_ARN: z.string().default(''),

  SES_ENABLED: booleanFromString(false),
  SES_FROM_ADDRESS: z.string().default(''),
});

export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
