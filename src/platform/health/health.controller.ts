import { Controller, Get } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
  MicroserviceHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaReadService } from '../../infrastructure/database/prisma/prisma-read.service';
import { PrismaWriteService } from '../../infrastructure/database/prisma/prisma-write.service';
import { ConfigurationService } from '../../config/configuration.service';
import { Public } from '../../shared-kernel/http/decorator/public.decorator';

/**
 * Health checks for the core infrastructure (database, redis, rabbitmq,
 * kafka). Disabled transports are skipped so health checks stay cheap.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly microservice: MicroserviceHealthIndicator,
    private readonly prismaRead: PrismaReadService,
    private readonly prismaWrite: PrismaWriteService,
    private readonly configuration: ConfigurationService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  public check(): Promise<HealthCheckResult> {
    const indicators: HealthIndicatorFunction[] = [
      () => this.prismaHealth.pingCheck('database-write', this.prismaWrite),
      () => this.prismaHealth.pingCheck('database-read', this.prismaRead),
    ];

    const redis = this.configuration.getRedis();
    if (redis.enabled) {
      indicators.push(() =>
        this.microservice.pingCheck('redis', {
          transport: Transport.REDIS,
          options: { host: redis.host, port: redis.port, password: redis.password || undefined },
        }),
      );
    }

    const rabbitmq = this.configuration.getRabbitMq();
    if (rabbitmq.enabled) {
      indicators.push(() =>
        this.microservice.pingCheck('rabbitmq', {
          transport: Transport.RMQ,
          options: { urls: [rabbitmq.url] },
        }),
      );
    }

    const kafka = this.configuration.getKafka();
    if (kafka.enabled) {
      indicators.push(() =>
        this.microservice.pingCheck('kafka', {
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: kafka.clientId,
              brokers: kafka.brokers.split(',').map((broker) => broker.trim()),
            },
            consumer: { groupId: kafka.groupId },
          },
        }),
      );
    }

    return this.health.check(indicators);
  }
}
