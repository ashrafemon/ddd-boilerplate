import 'reflect-metadata';

export const KAFKA_EVENT_LISTENER_METADATA = 'kafka-event-listener';

/**
 * Marks a provider method as a Kafka topic listener. The infrastructure
 * KafkaConsumerHost discovers decorated methods at bootstrap and wires them to
 * the broker using the topic as the subscription. Mirrors `@RabbitSubscribe` /
 * `@SqsMessageHandler`.
 */
export function KafkaEvent(topic: string): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void => {
    Reflect.defineMetadata(KAFKA_EVENT_LISTENER_METADATA, { topic }, descriptor.value as object);
    return descriptor;
  };
}
