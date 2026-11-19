import { Injectable } from '@nestjs/common';
import { InboxPort } from '../ports/inbox.port';
import {
  InboxReceiveRequest,
  InboxReceiveResult,
  InboxCompleteRequest,
  InboxFailRequest,
} from '../types/inbox.types';
import { ReceiveInboxMessageUseCase } from '../use-cases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from '../use-cases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from '../use-cases/fail-inbox-message.usecase';

/**
 * Inbound adapter implementing the public `InboxPort` — the single entry
 * point for inbox operations.
 *
 * Delegates to one use case per operation and holds no rules of its own. Every
 * broker/event consumer injects the port, never this class.
 */
@Injectable()
export class InboxAdapter implements InboxPort {
  constructor(
    private readonly receiveMessage: ReceiveInboxMessageUseCase,
    private readonly completeMessage: CompleteInboxMessageUseCase,
    private readonly failMessage: FailInboxMessageUseCase,
  ) {}

  async receive(request: InboxReceiveRequest): Promise<InboxReceiveResult> {
    return this.receiveMessage.execute(request);
  }

  async complete(request: InboxCompleteRequest): Promise<void> {
    return this.completeMessage.execute(request);
  }

  async fail(request: InboxFailRequest): Promise<void> {
    return this.failMessage.execute(request);
  }
}
