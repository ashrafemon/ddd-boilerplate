import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';

/**
 * SQS consumer for Product integration events following the @ssut/nestjs-sqs
 * pattern.
 */
@Injectable()
export class ProductSqsConsumer {
  private readonly logger = new Logger(ProductSqsConsumer.name);

  @SqsMessageHandler('consumer1', false)
  onMessage(message: unknown): void {
    this.logger.log(`[SQS] received ${JSON.stringify(message)}`);
  }
}
