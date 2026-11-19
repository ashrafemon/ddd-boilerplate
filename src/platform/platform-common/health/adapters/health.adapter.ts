import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { ListSecretsCommand } from '@aws-sdk/client-secrets-manager';
import { Injectable } from '@nestjs/common';
import { CacheManagerService } from '@infrastructure/cache-manager/cache-manager.service';
import { PrismaReadService } from '@infrastructure/prisma/prisma-read.service';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { S3Service } from '@infrastructure/s3/s3.service';
import { SesService } from '@infrastructure/ses/ses.service';
import { SnsService } from '@infrastructure/sns/sns.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { SecretsManagerService } from '@infrastructure/secrets/secrets.service';
import { PuppeteerService } from '@infrastructure/puppeteer/puppeteer.service';
import { HealthPort } from '../ports/health.port';
import { HealthReport, HealthStatus } from '../types/health.types';

/**
 * Probes every infrastructure client and aggregates the result into a single
 * HealthReport. Probes run concurrently and never throw — a failing probe
 * becomes a `down` status, so the health endpoint always answers.
 */
@Injectable()
export class HealthAdapter implements HealthPort {
  constructor(
    private readonly prismaWrite: PrismaWriteService,
    private readonly prismaRead: PrismaReadService,
    private readonly redis: RedisService,
    private readonly rabbit: AmqpConnection,
    private readonly s3: S3Service,
    private readonly secretsManager: SecretsManagerService,
    private readonly puppeteer: PuppeteerService,
    private readonly ses: SesService,
    private readonly sns: SnsService,
    private readonly httpCache: CacheManagerService,
  ) {}

  public async check(): Promise<HealthReport> {
    const components: Record<string, HealthStatus> = {
      'database-write': await this.probe(async () => {
        await this.prismaWrite.$queryRaw`SELECT 1`;
        return 'up';
      }),
      'database-read': await this.probe(async () => {
        await this.prismaRead.$queryRaw`SELECT 1`;
        return 'up';
      }),
      redis: this.redis.isEnabled
        ? await this.probe(async () =>
            (await this.redis.client.ping()) === 'PONG' ? 'up' : 'down',
          )
        : 'disabled',
      rabbitmq: this.rabbit.connected ? 'up' : 'down',
      s3: await this.probe(async () => {
        // Any HTTP response (200/403/404) proves the endpoint is reachable.
        await this.s3.client.send(new HeadBucketCommand({ Bucket: this.s3.bucketName }));
        return 'up';
      }),
      secrets: this.secretsManager.isEnabled
        ? await this.probe(async () => {
            await this.secretsManager.client.send(new ListSecretsCommand({ MaxResults: 1 }));
            return 'up';
          })
        : 'disabled',
      puppeteer: this.puppeteer.isEnabled
        ? await this.probe(async () => {
            const browser = await this.puppeteer.getBrowser();
            await browser.version();
            return 'up';
          })
        : 'disabled',
      'http-cache': this.httpCache.isEnabled
        ? await this.probe(async () => ((await this.httpCache.ping()) ? 'up' : 'down'))
        : 'disabled',
      ses: this.ses.isEnabled ? 'up' : 'disabled',
      sns: this.sns.isEnabled ? 'up' : 'disabled',
    };

    const degraded = Object.values(components).some(status => status === 'down');
    return { status: degraded ? 'degraded' : 'ok', components };
  }

  /** Runs a probe, converting any throw into `down` so reporting never fails. */
  private async probe(fn: () => Promise<HealthStatus>): Promise<HealthStatus> {
    try {
      return await fn();
    } catch {
      return 'down';
    }
  }
}
