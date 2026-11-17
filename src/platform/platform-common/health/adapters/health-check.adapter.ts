import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { KafkaService } from '@infrastructure/kafka/kafka.service';
import { PrismaReadService } from '@infrastructure/prisma/prisma-read.service';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { S3Service } from '@infrastructure/s3/s3.service';
import { SesService } from '@infrastructure/ses/ses.service';
import { SnsService } from '@infrastructure/sns/sns.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { HealthPort, HealthReport, HealthStatus } from '../ports/health.port';

/**
 * Probes every infrastructure client and aggregates the result into a single
 * HealthReport. Probes run concurrently and never throw — a failing probe
 * becomes a `down` status, so the health endpoint always answers.
 */
@Injectable()
export class HealthCheckAdapter implements HealthPort {
  constructor(
    private readonly prismaWrite: PrismaWriteService,
    private readonly prismaRead: PrismaReadService,
    private readonly redis: RedisService,
    private readonly rabbit: AmqpConnection,
    private readonly kafka: KafkaService,
    private readonly s3: S3Service,
    private readonly ses: SesService,
    private readonly sns: SnsService,
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
      kafka: this.kafka.isEnabled ? 'up' : 'disabled',
      s3: await this.probe(async () => {
        // Any HTTP response (200/403/404) proves the endpoint is reachable.
        await this.s3.client.send(new HeadBucketCommand({ Bucket: this.s3.bucketName }));
        return 'up';
      }),
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
