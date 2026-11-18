import { OutboxEventBase } from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Platform event emitted when a saga reaches COMPLETED (design 08's
 * `onComplete.emit`). It is appended to the saga's own `saga_outbox` ledger, so
 * business and platform consumers receive the canonical envelope while saga
 * lifecycle traffic stays isolated from `outbox_messages`.
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
