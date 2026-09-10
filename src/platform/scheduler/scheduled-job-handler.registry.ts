import { Injectable } from '@nestjs/common';
import {
  ScheduledJobFireHandler,
  ScheduledJobPayload,
} from './ports/scheduled-job-fire-handler.port';
import { DuplicateHandlerRegistrationError, UnregisteredHandlerError } from './scheduler.errors';

/**
 * Keyed by jobType. Dispatch checks here first; missing entry falls back to RabbitMQ.
 */
@Injectable()
export class ScheduledJobHandlerRegistry {
  private readonly handlers = new Map<string, ScheduledJobFireHandler>();

  register(jobType: string, handler: ScheduledJobFireHandler): void {
    if (this.handlers.has(jobType)) {
      throw new DuplicateHandlerRegistrationError(jobType);
    }
    this.handlers.set(jobType, handler);
  }

  has(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  resolveHandler(jobType: string): ScheduledJobFireHandler {
    const handler = this.handlers.get(jobType);
    if (!handler) {
      throw new UnregisteredHandlerError(jobType);
    }
    return handler;
  }

  /** Returns true if an in-process handler fired; false if none registered. */
  async tryFire(jobType: string, payload: ScheduledJobPayload): Promise<boolean> {
    const handler = this.handlers.get(jobType);
    if (!handler) {
      return false;
    }
    await handler.handle(payload);
    return true;
  }

  registeredJobTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
