import { z } from 'zod';
import { booleanFromString } from '../env-helpers';

/**
 * Messaging client group — RabbitMQ, Kafka and SQS credentials.
 */
export const messagingConfigSchema = z.object({
  RABBITMQ_ENABLED: booleanFromString(false),
  RABBITMQ_URL: z.string().default('amqp://erp:erp@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('erp.events'),
  RABBITMQ_QUEUE_PREFIX: z.string().default('erp'),

  KAFKA_ENABLED: booleanFromString(false),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('erp-api'),
  KAFKA_GROUP_ID: z.string().default('erp-consumer-group'),

  SQS_ENABLED: booleanFromString(false),
  SQS_QUEUE_URL: z.string().default(''),
});

export type MessagingConfig = z.infer<typeof messagingConfigSchema>;
