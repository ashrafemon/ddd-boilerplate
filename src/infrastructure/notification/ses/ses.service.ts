import { SESClient } from '@aws-sdk/client-ses';
import { ConfigService } from '@config/config.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * AWS SES email client. Explicit keys are used when present; otherwise the AWS
 * default credential chain (profile, IAM role, task role) resolves them. The
 * client is only skipped when there is no sender address to send from, so
 * local development runs without AWS.
 */
@Injectable()
export class SesService implements OnModuleInit, OnModuleDestroy {
  private readonly ses?: SESClient;
  private readonly fromAddress?: string;
  private readonly logger = new Logger(SesService.name);

  constructor(configService: ConfigService) {
    const config = configService.getSes();

    if (!config.address) {
      this.logger.warn('ses-disabled-missing-sender');
      return;
    }

    this.ses = new SESClient({
      region: config.region,
      ...(config.accessKey && config.secretKey
        ? { credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } }
        : {}),
    });
    this.fromAddress = config.address;
  }

  get isEnabled(): boolean {
    return this.ses !== undefined && this.fromAddress !== undefined;
  }

  onModuleInit() {
    this.logger.log(this.isEnabled ? 'ses-connected' : 'ses-disabled');
  }
  onModuleDestroy() {
    this.logger.log('ses-disconnected');
  }

  public get client(): SESClient | undefined {
    return this.ses;
  }

  public get address(): string | undefined {
    return this.fromAddress;
  }
}
