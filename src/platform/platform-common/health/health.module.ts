import { Module } from '@nestjs/common';
import { KafkaModule as InfraKafkaModule } from '@infrastructure/kafka/kafka.module';
import { PrismaModule as InfraPrismaModule } from '@infrastructure/prisma/prisma.module';
import { RabbitMqClientModule as InfraRabbitMqModule } from '@infrastructure/rabbitmq/rabbitmq.module';
import { RedisModule as InfraRedisModule } from '@infrastructure/redis/redis.module';
import { S3Module as InfraS3Module } from '@infrastructure/s3/s3.module';
import { SesModule as InfraSesModule } from '@infrastructure/ses/ses.module';
import { SnsModule as InfraSnsModule } from '@infrastructure/sns/sns.module';
import { HealthCheckAdapter } from './adapters/health-check.adapter';
import { HealthController } from './http/health.controller';
import { HealthPort } from './ports/health.port';

/**
 * Platform health module — aggregates infrastructure client status behind
 * HealthPort and exposes the readiness endpoint. Imports the client modules
 * it probes directly (Nest provider visibility follows the import chain).
 */
@Module({
  imports: [
    InfraPrismaModule,
    InfraRedisModule,
    InfraRabbitMqModule,
    InfraKafkaModule,
    InfraS3Module,
    InfraSesModule,
    InfraSnsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: HealthPort, useClass: HealthCheckAdapter }],
  exports: [HealthPort],
})
export class HealthModule {}
