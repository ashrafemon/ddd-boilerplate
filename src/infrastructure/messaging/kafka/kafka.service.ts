import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import { Kafka } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getKafka();
    this.kafka = new Kafka({ clientId: config.clientId, brokers: config.brokers });
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.kafka.producer().connect();
      this.logger.info('kafka-producer-connected');
    } catch (error) {
      this.logger.warn('kafka-producer-connection-failed', { error: (error as Error).message });
    }
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.kafka.producer().disconnect();
    } catch (error) {
      this.logger.warn('kafka-producer-disconnection-failed', { error: (error as Error).message });
    }
  }
}
