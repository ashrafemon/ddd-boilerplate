/**
 * Routes integration events to the appropriate broker. Product and purchase
 * order events go to RabbitMQ; catalog/product events also fan out to Kafka.
 * This policy is the single place where the "which broker" decision lives.
 */
export type BrokerTarget = 'rabbitmq' | 'kafka' | 'both';

export interface MessageRoutingPolicy {
  resolve(eventType: string): BrokerTarget;
}

export const MESSAGE_ROUTING_POLICY = Symbol('MESSAGE_ROUTING_POLICY');

export class DefaultMessageRoutingPolicy implements MessageRoutingPolicy {
  resolve(eventType: string): BrokerTarget {
    if (eventType.startsWith('Product')) {
      return 'both';
    }
    return 'rabbitmq';
  }
}
