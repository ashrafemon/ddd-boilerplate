import { OutboxEnvelope } from '@platform/platform-common/outbox/outbox.types';

export type JournalEntryPostedPublisherEvent = OutboxEnvelope;
export type VendorBillPostedPublisherEvent = OutboxEnvelope;
export type PaymentCompletedPublisherEvent = OutboxEnvelope;
