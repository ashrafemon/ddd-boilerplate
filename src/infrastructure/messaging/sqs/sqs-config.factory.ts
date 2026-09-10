import { ConfigService } from '@config/config.service';
import { SQSClient } from '@aws-sdk/client-sqs';
import type { SqsOptions } from '@ssut/nestjs-sqs/dist/sqs.types';

/**
 * Builds the SQS consumers/producers from the typed config facade. Returns
 * empty lists when no queue URL is configured so the module never polls an
 * empty URL. Plain function so `SqsModule.registerAsync` only injects the
 * global ConfigService.
 *
 * `SQS_ACCESS_KEY`/`SQS_SECRET_KEY` are honoured by handing the client an
 * explicit credential-backed `SQSClient`; without them the AWS default
 * credential chain applies.
 */
export function buildSqsOptions(config: ConfigService): SqsOptions {
  const sqs = config.getSqs();

  if (!sqs.url) {
    return { consumers: [], producers: [] };
  }

  const client =
    sqs.accessKey && sqs.secretKey
      ? new SQSClient({
          region: sqs.region,
          credentials: { accessKeyId: sqs.accessKey, secretAccessKey: sqs.secretKey },
        })
      : undefined;

  const consumer = {
    name: 'consumer1',
    queueUrl: sqs.url,
    region: sqs.region,
    ...(client ? { sqs: client } : {}),
  };
  const producer = {
    name: 'producer1',
    queueUrl: sqs.url,
    region: sqs.region,
    ...(client ? { sqs: client } : {}),
  };

  return { consumers: [consumer], producers: [producer] };
}
