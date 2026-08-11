import { z } from 'zod';

/**
 * AWS credentials group shared by the S3, SNS, SQS and SES clients.
 */
export const awsConfigSchema = z.object({
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
});

export type AwsConfig = z.infer<typeof awsConfigSchema>;
