/**
 * DI tokens for the concrete message publisher adapters. Provided by the
 * infrastructure MessagingModule; consumed by the platform outbox publisher.
 */
export const RABBITMQ_PUBLISHER = Symbol('RABBITMQ_PUBLISHER');
export const KAFKA_PUBLISHER = Symbol('KAFKA_PUBLISHER');
export const SQS_PUBLISHER = Symbol('SQS_PUBLISHER');
