export type BrokerTarget = 'rabbitmq' | 'kafka' | 'sqs';
export type BrokerTargets = BrokerTarget[];

export abstract class MessageRoutingPolicy {
  abstract resolve(eventType: string): BrokerTargets;
}

export class DefaultMessageRoutingPolicy implements MessageRoutingPolicy {
  resolve(eventType: string): BrokerTargets {
    if (eventType.startsWith('Product')) {
      return ['rabbitmq', 'kafka'];
    }
    return ['rabbitmq'];
  }
}
