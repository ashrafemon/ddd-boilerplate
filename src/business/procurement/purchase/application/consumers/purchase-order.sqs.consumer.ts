import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';

@Injectable()
export class PurchaseOrderSqsConsumer {
  private readonly logger = new Logger(PurchaseOrderSqsConsumer.name);

  @SqsMessageHandler('consumer1', false)
  onMessage(message: unknown): void {
    this.logger.log(`[SQS] received ${JSON.stringify(message)}`);
  }
}
