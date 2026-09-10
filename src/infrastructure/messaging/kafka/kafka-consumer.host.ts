import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Consumer } from 'kafkajs';
import { KAFKA_EVENT_LISTENER_METADATA } from '@shared-kernel/decorators/kafka-event.decorator';
import { KafkaService } from './kafka.service';

interface HandlerEntry {
  instance: object;
  handler: (payload: unknown, message: unknown) => unknown;
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
    if (!this.kafkaService.isEnabled) {
      this.logger.warn('Kafka is disabled; @KafkaEvent handlers will not receive messages');
      return;
    }

    const consumer = this.kafkaService.createConsumer();
    this.consumer = consumer;

    try {
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
            await entry.handler.call(entry.instance, payload, message);
          }
        },
      });
      this.logger.log(
        `Kafka consumer subscribed to topics: ${[...this.handlers.keys()].join(', ')}`,
      );
    } catch (error) {
      this.consumer = undefined;
      this.logger.error(
        `Kafka consumer wiring failed; @KafkaEvent handlers are inactive: ${(error as Error).message}`,
      );
      await consumer.disconnect().catch(() => undefined);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  /**
   * Reads listener metadata off prototype *descriptors* along the whole
   * prototype chain, so handlers inherited from a base class are found too.
   * Descriptors are never invoked: touching instance properties would run
   * arbitrary getters (e.g. Nest's `listen$`) and throw.
   */
  private collectHandlers(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as unknown;
      if (!instance || typeof instance !== 'object') continue;

      const seen = new Set<PropertyKey>();

      for (
        let target = this.handlerTarget(instance, wrapper.metatype);
        target;
        target = Object.getPrototypeOf(target) as Record<string, unknown> | null
      ) {
        if (target === Object.prototype) break;

        for (const propertyName of Object.getOwnPropertyNames(target)) {
          if (propertyName === 'constructor' || seen.has(propertyName)) continue;
          seen.add(propertyName);

          const method: unknown = Object.getOwnPropertyDescriptor(target, propertyName)?.value;
          if (typeof method !== 'function') continue;

          const metadata = Reflect.getMetadata(KAFKA_EVENT_LISTENER_METADATA, method) as
            { topic?: string } | undefined;
          if (!metadata?.topic) continue;

          const entries = this.handlers.get(metadata.topic) ?? [];
          entries.push({ instance, handler: method as HandlerEntry['handler'] });
          this.handlers.set(metadata.topic, entries);
        }
      }
    }
  }

  private handlerTarget(instance: object, metatype?: unknown): Record<string, unknown> | null {
    const fromMetatype = (metatype as { prototype?: unknown } | undefined)?.prototype;
    const candidate: unknown =
      fromMetatype && typeof fromMetatype === 'object'
        ? fromMetatype
        : Object.getPrototypeOf(instance);

    return candidate && candidate !== Object.prototype
      ? (candidate as Record<string, unknown>)
      : null;
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
