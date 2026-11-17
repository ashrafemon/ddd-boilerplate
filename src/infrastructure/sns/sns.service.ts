import { SNSClient } from '@aws-sdk/client-sns';
import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
import { Injectable, Logger } from '@nestjs/common';

/**
 * SNS notification client — client initialization only.
 *
 * Explicit keys are used when present; otherwise the AWS default credential
 * chain (profile, IAM role, task role) resolves them. The client is only
 * skipped when there is no topic ARN to publish to, so local development runs
 * without AWS. No shutdown lifecycle: the SDK client is stateless HTTP.
 */
@Injectable()
export class SnsService {
  private readonly sns?: SNSClient;
  private readonly topicArn?: string;
  private readonly logger = new Logger(SnsService.name);

  constructor(configService: ConfigService) {
    const config = configService.getSns();

    if (!config.topicArn) {
      if (configService.isProduction) {
        throw new InfrastructureException('sns-not-configured', {
          reason: 'SNS topic ARN is required in production',
        });
      }
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

  public get client(): SNSClient | undefined {
    return this.sns;
  }

  public get topic(): string | undefined {
    return this.topicArn;
  }
}
