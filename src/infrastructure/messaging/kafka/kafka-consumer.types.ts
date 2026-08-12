import type { Kafka, Consumer } from 'kafkajs';

/** Factory that creates a fresh Kafka consumer bound to the shared client. */
export interface KafkaConsumerFactory {
  createConsumer(): Consumer;
}

/** Minimal surface used by the consumer host. */
export interface KafkaClientLike {
  kafka: Kafka;
  createConsumer(): Consumer;
}
