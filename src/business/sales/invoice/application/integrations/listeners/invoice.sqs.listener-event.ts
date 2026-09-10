import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';

/**
 * SQS listener for Invoice integration events following the @ssut/nestjs-sqs
 * pattern.
 */
@Injectable()
export class InvoiceSqsListener {
  private readonly logger = new Logger(InvoiceSqsListener.name);

  @SqsMessageHandler('consumer1', false)
  onMessage(message: unknown): void {
    this.logger.log(`[SQS] received ${JSON.stringify(message)}`);
  }
}
