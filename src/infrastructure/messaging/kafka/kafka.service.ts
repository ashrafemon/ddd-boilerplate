import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import { Consumer, Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumerGroupId: string;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getKafka();
    this.kafka = new Kafka({ clientId: config.clientId, brokers: config.brokers });
    this.producer = this.kafka.producer();
    this.consumerGroupId = config.groupId;
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.info('kafka-producer-connected');
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
    return this.kafka.consumer({ groupId: this.consumerGroupId });
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.producer.disconnect();
    } catch (error) {
      this.logger.warn('kafka-producer-disconnection-failed', { error: (error as Error).message });
    }
  }
}
