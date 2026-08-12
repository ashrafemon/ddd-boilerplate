/**
 * Routes integration events to the appropriate brokers. This policy is the
 * single place where the "which broker(s)" decision lives.
 */
export type BrokerTarget = 'rabbitmq' | 'kafka' | 'sqs';
export type BrokerTargets = BrokerTarget[];

export interface MessageRoutingPolicy {
  resolve(eventType: string): BrokerTargets;
}

export const MESSAGE_ROUTING_POLICY = Symbol('MESSAGE_ROUTING_POLICY');

export class DefaultMessageRoutingPolicy implements MessageRoutingPolicy {
  resolve(eventType: string): BrokerTargets {
    if (eventType.startsWith('Product')) {
      return ['rabbitmq', 'kafka'];
    }
    return ['rabbitmq'];
  }
}
