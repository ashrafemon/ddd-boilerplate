import { SESClient } from '@aws-sdk/client-ses';
import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';

@Injectable()
export class SesService implements OnModuleInit, OnModuleDestroy {
  private readonly ses!: SESClient;
  private readonly fromAddress!: string;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getSes();
    if (!config?.accessKey || !config.secretKey || !config.address) {
      return;
    }

    this.ses = new SESClient({
      region: config.region,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
    this.fromAddress = config.address;
  }

  onModuleInit() {
    this.logger.info('Ses connected');
  }
  onModuleDestroy() {
    this.logger.info('Ses disconnected');
  }

  public get client(): SESClient {
    return this.ses;
  }

  public get address(): string {
    return this.fromAddress;
  }
}
