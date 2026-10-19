import { OutboxEventBase } from '@platform/outbox/outbox.types';

/**
 * Platform event emitted when a saga reaches COMPLETED (design 08's
 * `onComplete.emit`). It rides the normal outbox pipeline, so business and
 * platform consumers receive the canonical envelope.
 */
export class SagaEmittedEvent extends OutboxEventBase {
  constructor(
    readonly eventName: string,
    readonly detail: {
      sagaKey: string;
      instanceId: string;
      correlationKey: string;
    },
  ) {
    super();
  }
}
