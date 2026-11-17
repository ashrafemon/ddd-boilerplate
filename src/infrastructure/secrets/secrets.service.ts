import { SecretsManagerClient, ListSecretsCommand } from '@aws-sdk/client-secrets-manager';
import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * AWS Secrets Manager client — client initialization only.
 *
 * Opt-in via `SECRETS_MANAGER_ENABLED`; disabled is a legitimate choice (env
 * secrets), so being disabled never fails the boot. When enabled, the boot
 * probe is fail-closed in production. Secret reads (which secret, which key,
 * caching policy) are platform-capability decisions and live in the platform
 * layer — not here.
 */
@Injectable()
export class SecretsManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly clientInstance?: SecretsManagerClient;
  private readonly isProduction: boolean;
  private readonly logger = new Logger(SecretsManagerService.name);

  constructor(configService: ConfigService) {
    const config = configService.getSecretsManager();

    this.isProduction = configService.isProduction;

    if (!config.enabled) {
      this.logger.warn('secrets-manager-disabled');
      return;
    }

    this.clientInstance = new SecretsManagerClient({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      // Bound every request — a black-holed network must not stall boot.
      requestHandler: { connectTimeout: 3_000, requestTimeout: 5_000 },
    });
  }

  get isEnabled(): boolean {
    return this.clientInstance !== undefined;
  }

  /** The configured Secrets Manager client. Throws rather than returning undefined. */
  get client(): SecretsManagerClient {
    if (!this.clientInstance) {
      throw new InfrastructureException('Secrets Manager client is not initialized');
    }
    return this.clientInstance;
  }

  public async onModuleInit(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.client.send(new ListSecretsCommand({ MaxResults: 1 }));
      this.logger.log('secrets-manager-connected');
    } catch (error) {
      const reason = (error as Error).message;
      if (this.isProduction) {
        throw new InfrastructureException('secrets-manager-unreachable', { reason });
      }
      this.logger.warn(`secrets-manager-unreachable: ${reason}`);
    }
  }

  public onModuleDestroy(): void {
    this.clientInstance?.destroy();
  }
}
