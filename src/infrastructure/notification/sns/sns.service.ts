import { SNSClient } from '@aws-sdk/client-sns';
import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

/**
 * AWS SNS notification adapter. Self-disables when SNS is not configured so
 * local development runs without AWS.
 */
@Injectable()
export class SnsService implements OnModuleInit, OnModuleDestroy {
  private readonly sns!: SNSClient;
  private readonly topicArn!: string;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getSns();
    if (!config.accessKey || !config.secretKey || !config.topicArn) {
      return;
    }

    this.sns = new SNSClient({
      region: config.region,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
    this.topicArn = config.topicArn;
  }

  onModuleInit() {
    this.logger.info('Sns connected');
  }
  onModuleDestroy() {
    this.logger.info('Sns disconnected');
  }

  public get client(): SNSClient {
    return this.sns;
  }

  public get topic(): string {
    return this.topicArn;
  }
}
