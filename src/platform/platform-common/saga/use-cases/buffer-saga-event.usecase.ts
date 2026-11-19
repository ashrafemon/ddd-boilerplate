import { Injectable } from '@nestjs/common';
import { SagaInstanceRecord } from '../types/saga.types';
import { SagaInboxPort } from '@platform/platform-common/saga-inbox/ports/saga-inbox.port';
import { AdvanceSagaUseCase } from './advance-saga.usecase';

/** Payload of one event routed to a live instance. */
export interface BufferSagaEventInput {
  instance: SagaInstanceRecord;
  eventId: string;
  eventName: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  payloadHash?: string | null;
  headers?: Record<string, string> | null;
}

/**
 * Use case: buffer an event for a live instance and try to consume it.
 *
 * The insert is the dedupe: a redelivered event returns `false` and the instance
 * is not advanced twice. The `consumer` key is per instance, so two instances of
 * the same saga keep independent inbox rows for the same event.
 */
@Injectable()
export class BufferSagaEventUseCase {
  constructor(
    private readonly inbox: SagaInboxPort,
    private readonly advanceSaga: AdvanceSagaUseCase,
  ) {}

  async execute(input: BufferSagaEventInput): Promise<boolean> {
    const { instance } = input;
    const recorded = await this.inbox.buffer({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      consumer: `${instance.sagaKey}:${instance.id}`,
      eventId: input.eventId,
      eventName: input.eventName,
      eventVersion: input.eventVersion,
      correlationKey: instance.correlationKey,
      instanceId: instance.id,
      payload: input.payload,
      payloadHash: input.payloadHash ?? null,
      headers: input.headers ?? null,
    });
    if (!recorded) {
      return false;
    }
    await this.advanceSaga.execute(instance.id);
    return true;
  }
}
