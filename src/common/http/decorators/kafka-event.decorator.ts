import 'reflect-metadata';

export const KAFKA_EVENT_LISTENER_METADATA = 'kafka-event-listener';

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
