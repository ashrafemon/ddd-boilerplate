import { SNSClient } from '@aws-sdk/client-sns';
import { ConfigService } from '@config/config.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * AWS SNS notification client. Explicit keys are used when present; otherwise
 * the AWS default credential chain (profile, IAM role, task role) resolves
 * them. The client is only skipped when there is no topic ARN to publish to,
 * so local development runs without AWS.
 */
@Injectable()
export class SnsService implements OnModuleInit, OnModuleDestroy {
  private readonly sns?: SNSClient;
  private readonly topicArn?: string;
  private readonly logger = new Logger(SnsService.name);

  constructor(configService: ConfigService) {
    const config = configService.getSns();

    if (!config.topicArn) {
      this.logger.warn('sns-disabled-missing-topic');
      return;
    }

    this.sns = new SNSClient({
      region: config.region,
      ...(config.accessKey && config.secretKey
        ? { credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } }
        : {}),
    });
    this.topicArn = config.topicArn;
  }

  get isEnabled(): boolean {
    return this.sns !== undefined && this.topicArn !== undefined;
  }

  onModuleInit() {
    this.logger.log(this.isEnabled ? 'sns-connected' : 'sns-disabled');
  }
  onModuleDestroy() {
    this.logger.log('sns-disconnected');
  }

  public get client(): SNSClient | undefined {
    return this.sns;
  }

  public get topic(): string | undefined {
    return this.topicArn;
  }
}
