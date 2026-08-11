import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SqsConfigFactory {
  constructor(private readonly config: ConfigService) {}

  public createSqsOptions() {
    const sqs = this.config.get<{ url: string; region?: string }>('messaging.sqs', {
      url: '',
      region: 'us-east-1',
    });

    // SQS is not configured — register no consumers/producers so the module
    // does not try to poll an empty queue URL.
    if (!sqs.url) {
      return { consumers: [], producers: [] };
    }

    return {
      consumers: [{ name: 'consumer1', queueUrl: sqs.url, region: sqs.region }],
      producers: [{ name: 'producer1', queueUrl: sqs.url, region: sqs.region }],
    };
  }
}
