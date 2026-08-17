/**
 * DI tokens for the concrete message publisher adapters. Provided by the
 * infrastructure MessagingModule; consumed by the platform outbox publisher.
 */
export abstract class RabbitMqPublisher {}
export abstract class KafkaPublisher {}
export abstract class SqsPublisher {}
