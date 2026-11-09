import { OutboxEnvelope } from '@platform/platform-common/outbox/outbox.types';

export type PriceListCreatedPublisherEvent = OutboxEnvelope;
export type PriceListUpdatedPublisherEvent = OutboxEnvelope;
export type PriceListActivatedPublisherEvent = OutboxEnvelope;
export type PriceListDeactivatedPublisherEvent = OutboxEnvelope;
export type PriceListArchivedPublisherEvent = OutboxEnvelope;
export type PriceListLineAddedPublisherEvent = OutboxEnvelope;
export type PriceListLineUpdatedPublisherEvent = OutboxEnvelope;
export type PriceListLineRemovedPublisherEvent = OutboxEnvelope;
