import { SESClient } from '@aws-sdk/client-ses';
import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';

/**
 * AWS SES email client. Falls back to the AWS default credential chain when
 * no explicit keys are configured. Self-disables (no client created) when SES
 * is not configured so local development runs without AWS.
 */
@Injectable()
export class SesService implements OnModuleInit, OnModuleDestroy {
  private readonly ses?: SESClient;
  private readonly fromAddress?: string;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getSes();

    if (!config.accessKey || !config.secretKey || !config.address) {
      this.logger.warn('ses-disabled-missing-config');
      return;
    }

    this.ses = new SESClient({
      region: config.region,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
    this.fromAddress = config.address;
  }

  get isEnabled(): boolean {
    return this.ses !== undefined && this.fromAddress !== undefined;
  }

  onModuleInit() {
    this.logger.info(this.isEnabled ? 'ses-connected' : 'ses-disabled');
  }
  onModuleDestroy() {
    this.logger.info('ses-disconnected');
  }

  public get client(): SESClient | undefined {
    return this.ses;
  }

  public get address(): string | undefined {
    return this.fromAddress;
  }
}
