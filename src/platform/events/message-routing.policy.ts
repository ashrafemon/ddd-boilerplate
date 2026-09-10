export type BrokerTarget = 'rabbitmq' | 'kafka' | 'sqs';
export type BrokerTargets = BrokerTarget[];

export abstract class MessageRoutingPolicy {
  abstract resolve(eventType: string): BrokerTargets;
}

/**
 * Event types that have broker listeners beyond RabbitMQ. Everything else is
 * published to RabbitMQ only, which keeps fan-out explicit: adding a Kafka/SQS
 * listener for an event means adding that event here.
 */
const FAN_OUT_EVENTS: Record<string, BrokerTargets> = {
  ProductCreated: ['rabbitmq', 'kafka', 'sqs'],
  VendorCreated: ['rabbitmq', 'kafka', 'sqs'],
  PurchaseOrderCreated: ['rabbitmq', 'kafka', 'sqs'],
  GrnCreated: ['rabbitmq', 'kafka', 'sqs'],
  InvoiceCreated: ['rabbitmq', 'kafka', 'sqs'],
};

export class DefaultMessageRoutingPolicy implements MessageRoutingPolicy {
  resolve(eventType: string): BrokerTargets {
    return FAN_OUT_EVENTS[eventType] ?? ['rabbitmq'];
  }
}
