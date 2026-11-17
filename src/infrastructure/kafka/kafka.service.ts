import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
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
      if (configService.isProduction) {
        throw new InfrastructureException('kafka-not-configured', {
          reason: 'KAFKA_BROKERS is required in production',
        });
      }
      this.logger.warn('kafka-disabled-missing-brokers');
      this.consumerGroupId = config.groupId;
      return;
    }

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      // A bounded connect budget: Kafka is opt-in and may simply not be
      // running. Without this the default retry policy blocks app bootstrap
      // for tens of seconds before giving up.
      connectionTimeout: config.connectionTimeoutMs,
      retry: { retries: config.retryCount, initialRetryTime: 300, maxRetryTime: 3000 },
    });
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

  /**
   * Client-level consumer operation: connects a shared consumer, subscribes it
   * to the given topics and hands each message's raw value to `onMessage`.
   * All kafkajs wiring stays inside this client — the caller supplies only
   * topics and a callback.
   *
   * Supervised: if the consumer run crashes, it is restarted with capped
   * exponential backoff (1s → 30s) instead of staying dead until process
   * restart. Returns a handle that stops the loop and disconnects.
   */
  public async startConsumer(input: {
    topics: string[];
    onMessage: (message: { topic: string; value: string | null }) => Promise<void> | void;
  }): Promise<{ stop(): Promise<void> }> {
    if (!this.kafka) {
      throw new InfrastructureException('Kafka is not configured: set KAFKA_BROKERS');
    }

    const consumer = this.kafka.consumer({ groupId: this.consumerGroupId });
    await consumer.connect();
    for (const topic of input.topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    let stopped = false;
    let attempt = 0;

    const runLoop = async (): Promise<void> => {
      while (!stopped) {
        try {
          // Resolves only when the consumer STOPS cleanly; a crash throws.
          await consumer.run({
            eachMessage: async ({ topic, message }) => {
              await input.onMessage({ topic, value: message.value?.toString() ?? null });
            },
          });
          return;
        } catch (error) {
          if (stopped) return;
          attempt += 1;
          const delayMs = Math.min(1_000 * 2 ** (attempt - 1), 30_000);
          this.logger.error(
            `kafka-consumer-crashed; restarting in ${delayMs}ms (attempt ${attempt}): ${(error as Error).message}`,
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
          if (stopped) return;
          // Rebuild the connection before re-running — a crash may have torn
          // the underlying socket down.
          await consumer.disconnect().catch(() => undefined);
          await consumer.connect();
          for (const topic of input.topics) {
            await consumer.subscribe({ topic, fromBeginning: false });
          }
        }
      }
    };

    void runLoop();

    return {
      stop: async () => {
        stopped = true;
        await consumer.disconnect().catch(() => undefined);
      },
    };
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.producer?.disconnect();
    } catch (error) {
      this.logger.warn('kafka-producer-disconnection-failed', { error: (error as Error).message });
    }
  }
}
