import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Consumer } from 'kafkajs';
import { KAFKA_EVENT_LISTENER_METADATA } from '@shared-kernel/decorators/kafka-event.decorator';
import { KafkaService } from './kafka.service';

interface HandlerEntry {
  instance: object;
  method: string;
}

/**
 * Binds every `@KafkaEvent(topic)` handler discovered in the application to a
 * shared consumer. The consumer subscribes to each unique topic and dispatches
 * the parsed payload to all matching handlers.
 */
@Injectable()
export class KafkaConsumerHost implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerHost.name);
  private readonly handlers = new Map<string, HandlerEntry[]>();
  private consumer?: Consumer;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly kafkaService: KafkaService,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    this.collectHandlers();
    if (this.handlers.size === 0) {
      this.logger.log('No @KafkaEvent handlers found; skipping consumer wiring');
      return;
    }

    try {
      const consumer = this.kafkaService.createConsumer();
      await consumer.connect();
      for (const topic of this.handlers.keys()) {
        await consumer.subscribe({ topic, fromBeginning: false });
      }
      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          const entries = this.handlers.get(topic);
          if (!entries) return;
          const payload = this.parse(message.value?.toString());
          for (const entry of entries) {
            const instance = entry.instance as Record<
              string,
              { call: (thisArg: unknown, ...args: unknown[]) => Promise<void> | void }
            >;
            const fn = instance[entry.method];
            await fn.call(entry.instance, payload, message);
          }
        },
      });
      this.consumer = consumer;
      this.logger.log(
        `Kafka consumer subscribed to topics: ${[...this.handlers.keys()].join(', ')}`,
      );
    } catch (error) {
      this.logger.warn(`Kafka consumer wiring failed: ${(error as Error).message}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  private collectHandlers(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const rawInstance = wrapper.instance as unknown;
      if (!rawInstance || typeof rawInstance !== 'object') continue;
      const instance = rawInstance as Record<string, unknown>;
      const prototype: unknown = Object.getPrototypeOf(instance);
      if (!prototype || prototype === Object.prototype) continue;
      const prototypeRecord = prototype as Record<string, unknown>;

      for (const methodName of Object.getOwnPropertyNames(prototypeRecord)) {
        const method = prototypeRecord[methodName];
        if (typeof method !== 'function') continue;
        const metadata = Reflect.getMetadata(KAFKA_EVENT_LISTENER_METADATA, method) as
          { topic?: string } | undefined;
        if (!metadata?.topic) continue;
        const list = this.handlers.get(metadata.topic) ?? [];
        list.push({ instance, method: methodName });
        this.handlers.set(metadata.topic, list);
      }
    }
  }

  private parse(raw?: string): unknown {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
}
