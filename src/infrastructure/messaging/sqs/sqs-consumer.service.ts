import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { IntegrationMessage } from '../../../shared-kernel/ports/messaging/integration-message';
import { IntegrationMessageProcessor } from '../../../platform/messaging/integration-message-processor.service';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

const POLL_WAIT_TIME_SECONDS = 10;
const RETRY_BACKOFF_MS = 5_000;

/**
 * AWS SQS consumer. Polls the configured queue, processes messages through the
 * shared pipeline and deletes them on success. Failed messages are left in the
 * queue so the visibility timeout retries them; a queue redrive policy moves
 * poison messages to the dead-letter queue.
 */
@Injectable()
export class SqsConsumerService implements OnModuleInit, OnApplicationShutdown {
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private stopped = false;

  constructor(
    configuration: ConfigurationService,
    private readonly processor: IntegrationMessageProcessor,
    private readonly logger: LoggerPort,
  ) {
    const aws = configuration.getAws();
    const sqsSettings = configuration.getSqs();
    this.sqs = new SQSClient({
      region: aws.region,
      credentials:
        aws.accessKeyId && aws.secretAccessKey
          ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey }
          : undefined,
    });
    this.queueUrl = sqsSettings.queueUrl;
  }

  public async onModuleInit(): Promise<void> {
    this.logger.info('sqs-consumer-started', { queueUrl: this.queueUrl });
    void this.consumeLoop();
  }

  public onApplicationShutdown(): void {
    this.stopped = true;
    this.sqs.destroy();
  }

  private async consumeLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        const response = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: POLL_WAIT_TIME_SECONDS,
            MessageAttributeNames: ['All'],
          }),
        );

        for (const message of response.Messages ?? []) {
          await this.handleMessage(message);
        }
      } catch (error) {
        this.logger.error('sqs-receive-failed', { error: errorMessageOf(error) });
        await sleep(RETRY_BACKOFF_MS);
      }
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    const receiptHandle = message.ReceiptHandle;
    try {
      const raw = message.Body ?? '';
      const integration = JSON.parse(raw) as IntegrationMessage;
      await this.processor.process(integration);
      if (receiptHandle) {
        await this.sqs.send(
          new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }),
        );
      }
    } catch (error) {
      this.logger.error('sqs-message-failed', {
        messageId: message.MessageId,
        error: errorMessageOf(error),
      });
    }
  }
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
