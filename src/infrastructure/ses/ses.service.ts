import { SESClient } from '@aws-sdk/client-ses';
import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
import { Injectable, Logger } from '@nestjs/common';

/**
 * SES email client — client initialization only.
 *
 * Explicit keys are used when present; otherwise the AWS default credential
 * chain (profile, IAM role, task role) resolves them. The client is only
 * skipped when there is no sender address to send from, so local development
 * runs without AWS. No shutdown lifecycle: the SDK client is stateless HTTP.
 */
@Injectable()
export class SesService {
  private readonly ses?: SESClient;
  private readonly fromAddress?: string;
  private readonly logger = new Logger(SesService.name);

  constructor(configService: ConfigService) {
    const config = configService.getSes();

    if (!config.address) {
      if (configService.isProduction) {
        throw new InfrastructureException('ses-not-configured', {
          reason: 'SES sender address is required in production',
        });
      }
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

  public get client(): SESClient | undefined {
    return this.ses;
  }

  public get address(): string | undefined {
    return this.fromAddress;
  }
}
