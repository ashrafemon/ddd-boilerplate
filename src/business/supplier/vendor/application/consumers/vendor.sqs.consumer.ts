import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';

@Injectable()
export class VendorSqsConsumer {
  private readonly logger = new Logger(VendorSqsConsumer.name);

  @SqsMessageHandler('consumer1', false)
  onMessage(message: unknown): void {
    this.logger.log(`[SQS] received ${JSON.stringify(message)}`);
  }
}
