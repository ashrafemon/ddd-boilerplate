import { SNSClient } from '@aws-sdk/client-sns';
import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';

/**
 * AWS SNS notification client. Falls back to the AWS default credential chain
 * when no explicit keys are configured. Self-disables (no client created)
 * when SNS is not configured so local development runs without AWS.
 */
@Injectable()
export class SnsService implements OnModuleInit, OnModuleDestroy {
  private readonly sns?: SNSClient;
  private readonly topicArn?: string;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getSns();

    if (!config.accessKey || !config.secretKey || !config.topicArn) {
      this.logger.warn('sns-disabled-missing-config');
      return;
    }

    this.sns = new SNSClient({
      region: config.region,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
    this.topicArn = config.topicArn;
  }

  get isEnabled(): boolean {
    return this.sns !== undefined && this.topicArn !== undefined;
  }

  onModuleInit() {
    this.logger.info(this.isEnabled ? 'sns-connected' : 'sns-disabled');
  }
  onModuleDestroy() {
    this.logger.info('sns-disconnected');
  }

  public get client(): SNSClient | undefined {
    return this.sns;
  }

  public get topic(): string | undefined {
    return this.topicArn;
  }
}
