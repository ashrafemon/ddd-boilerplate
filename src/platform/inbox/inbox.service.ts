import { Injectable } from '@nestjs/common';
import { InboxPort } from './ports/inbox.port';
import {
  InboxReceiveRequest,
  InboxReceiveResult,
  InboxCompleteRequest,
  InboxFailRequest,
} from './inbox.types';
import { ReceiveInboxMessageUseCase } from './usecases/receive-inbox-message.usecase';
import { CompleteInboxMessageUseCase } from './usecases/complete-inbox-message.usecase';
import { FailInboxMessageUseCase } from './usecases/fail-inbox-message.usecase';

/**
 * Inbox service facade — the single entry point for all inbox operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public InboxPort.
 */
@Injectable()
export class InboxService implements InboxPort {
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
