import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@shared-kernel/exceptions/infrastructure.exception';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka?: Kafka;
  private readonly producer?: Producer;
  private readonly consumerGroupId: string;
  private readonly logger = new Logger(KafkaService.name);

  constructor(configService: ConfigService) {
    const config = configService.getKafka();

    if (config.brokers.length === 0) {
      this.logger.warn('kafka-disabled-missing-brokers');
      this.consumerGroupId = config.groupId;
      return;
    }

    this.kafka = new Kafka({ clientId: config.clientId, brokers: config.brokers });
    this.producer = this.kafka.producer();
    this.consumerGroupId = config.groupId;
  }

  /** False when `KAFKA_BROKERS` is empty — publishing/consuming is disabled. */
  get isEnabled(): boolean {
    return this.producer !== undefined;
  }

  public async onModuleInit(): Promise<void> {
    if (!this.producer) return;

    try {
      await this.producer.connect();
      this.logger.log('kafka-producer-connected');
    } catch (error) {
      this.logger.warn('kafka-producer-connection-failed', { error: (error as Error).message });
    }
  }

  public async send(input: {
    topic: string;
    key?: string;
    value: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    if (!this.producer) {
      throw new InfrastructureException('Kafka is not configured: set KAFKA_BROKERS');
    }

    await this.producer.send({
      topic: input.topic,
      messages: [
        {
          key: input.key,
          value: input.value,
          headers: input.headers,
        },
      ],
    });
  }

  /** Create a consumer bound to this service's client + group. */
  public createConsumer(): Consumer {
    if (!this.kafka) {
      throw new InfrastructureException('Kafka is not configured: set KAFKA_BROKERS');
    }

    return this.kafka.consumer({ groupId: this.consumerGroupId });
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.producer?.disconnect();
    } catch (error) {
      this.logger.warn('kafka-producer-disconnection-failed', { error: (error as Error).message });
    }
  }
}
