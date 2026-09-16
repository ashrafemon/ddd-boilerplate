export abstract class WebhookQueuePublisherPort {
  abstract enqueueDelivery(deliveryId: string): Promise<void>;
}
