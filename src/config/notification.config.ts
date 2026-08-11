import { registerAs } from '@nestjs/config';

export type ISnsConfig = {
  enabled: boolean;
  accessKey: string;
  secretKey: string;
  topicArn: string;
  region?: string;
};
export type ISesConfig = {
  enabled: boolean;
  accessKey: string;
  secretKey: string;
  address: string;
  region?: string;
};

/**
 * Notification config — AWS SNS (push) and SES (email) settings. Adapters
 * self-disable when the corresponding service is not configured.
 */
export default registerAs('notification', () => ({
  sns: {
    enabled: (process.env.SNS_ENABLED ?? 'false') === 'true',
    accessKey: process.env.SNS_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? '',
    secretKey: process.env.SNS_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
    topicArn: process.env.SNS_TOPIC_ARN ?? '',
    region: process.env.SNS_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  },
  ses: {
    enabled: (process.env.SES_ENABLED ?? 'false') === 'true',
    accessKey: process.env.SES_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? '',
    secretKey: process.env.SES_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
    address: process.env.SES_FROM_ADDRESS ?? '',
    region: process.env.SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  },
}));
