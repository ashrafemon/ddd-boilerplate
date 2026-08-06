import { registerAs } from '@nestjs/config';

/**
 * RabbitMQ config — AMQP connection URL for the event bus.
 */
export default registerAs('message', () => ({
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
  },
}));
