import { Provider } from '@nestjs/common';
import {
  AbacCheck,
  AbacPort,
  AbacResult,
} from '@platform/platform-organization/authorization/ports/abac.port';
import {
  CompanyConfig,
  CompanyConfigPort,
} from '@platform/platform-organization/configuration/ports/company-config.port';
import {
  AppendOutboxOptions,
  OutboxWriterPort,
} from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AuditEntry, AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { CachePort } from '@platform/platform-common/cache/ports/cache.port';
import { CacheGetResult, CacheKey } from '@platform/platform-common/cache/types/cache.types';
import { InboxPort } from '@platform/platform-common/inbox/ports/inbox.port';
import { InboxReceiveResult } from '@platform/platform-common/inbox/types/inbox.types';
import { LogFields, LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import {
  NextNumberOptions,
  NumberingPort,
} from '@platform/platform-common/numbering/ports/numbering.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringTemplatePort } from '@platform/platform-common/recurring/ports/recurring-template.port';
import { InMemoryRequestContextService } from '../context/in-memory-request-context';

/**
 * Recording doubles for the platform ports a business module may inject.
 *
 * Component tests let Nest build the module's real provider graph, so every
 * injected token must resolve — including the platform capabilities the module
 * legitimately depends on (outbox, ABAC, request context, numbering, ...).
 * These doubles keep the graph honest without any IO: no database, no broker,
 * no Redis, no CLS.
 */

export interface RecordedOutboxAppend {
  event: OutboxEvent;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  opts?: AppendOutboxOptions;
}

export class RecordingOutboxWriter extends OutboxWriterPort {
  public readonly appended: RecordedOutboxAppend[] = [];

  public async append(
    event: OutboxEvent,
    aggregateType: string,
    aggregateId: string,
    opts?: AppendOutboxOptions,
  ): Promise<void> {
    this.appended.push({
      event,
      eventType: String((event as { eventType?: string }).eventType ?? ''),
      aggregateType,
      aggregateId,
      opts,
    });
  }

  public eventTypes(): string[] {
    return this.appended.map(entry => entry.eventType);
  }
}

export class AllowAbacPort extends AbacPort {
  public readonly checks: AbacCheck[] = [];

  constructor(private readonly decision: 'ALLOW' | 'DENY' = 'ALLOW') {
    super();
  }

  /** Last check evaluated — typed accessor so specs never index into `any`. */
  public lastCheck(): AbacCheck {
    const last = this.checks[this.checks.length - 1];
    if (!last) throw new Error('ABAC was never evaluated in this component test');
    return last;
  }

  public async evaluate(check: AbacCheck): Promise<AbacResult> {
    this.checks.push(check);
    return this.decision === 'ALLOW'
      ? { decision: 'ALLOW' }
      : { decision: 'DENY', reason: 'denied by test double' };
  }
}

export class FakeCompanyConfigPort extends CompanyConfigPort {
  constructor(public config: CompanyConfig = defaultCompanyConfig()) {
    super();
  }

  public async getCompanyConfig(_companyId?: string): Promise<CompanyConfig> {
    return this.config;
  }
}

export class RecordingAuditPort extends AuditPort {
  public readonly entries: AuditEntry[] = [];

  public async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class SilentLoggerPort extends LoggerPort {
  public debug(_message: string, _fields?: LogFields): void {}
  public info(_message: string, _fields?: LogFields): void {}
  public warn(_message: string, _fields?: LogFields): void {}
  public error(_message: string, _fields?: LogFields): void {}
  public fatal(_message: string, _fields?: LogFields): void {}
}

export class FakeNumberingPort extends NumberingPort {
  private seq = 0;

  public async nextNumber(sequenceKey: string, options?: NextNumberOptions): Promise<string> {
    this.seq += 1;
    const padding = options?.padding ?? 6;
    const suffix = String(this.seq).padStart(padding, '0');
    return options?.prefix ? `${options.prefix}${suffix}` : `${sequenceKey}-${suffix}`;
  }
}

/** Cache double that behaves like an always-miss store. */
export class EmptyCachePort extends CachePort {
  public buildKey(identity: CacheKey): string {
    const parts = [
      identity.tenantId,
      identity.companyId,
      identity.namespace,
      identity.resource,
      identity.variant,
    ].filter(Boolean);
    return ['cache', ...parts].join(':');
  }

  public async get<_T>(): Promise<CacheGetResult<_T>> {
    return { status: 'MISS' };
  }

  public async set<_T>(): Promise<void> {}

  public async delete(): Promise<void> {}
}

export class NoopInboxPort extends InboxPort {
  public async receive(): Promise<InboxReceiveResult> {
    return { status: 'ACQUIRED', reservation: { id: 'inbox-1', claimToken: 'token-1' } };
  }
  public async complete(): Promise<void> {}
  public async fail(): Promise<void> {}
}

export class NoopRecurringExecutionPort extends RecurringExecutionPort {
  public async findById(): Promise<null> {
    return null;
  }
  public async complete(): Promise<void> {}
  public async fail(): Promise<void> {}
}

export class NoopRecurringTemplatePort extends RecurringTemplatePort {
  public async create(): Promise<never> {
    throw new Error('recurring templates are not used in this component test');
  }
}

export function defaultCompanyConfig(overrides: Partial<CompanyConfig> = {}): CompanyConfig {
  return {
    companyId: 'company-1',
    companyCode: 'C1',
    companyName: 'Test Company',
    defaultCurrency: 'USD',
    autoApproveThreshold: 1000,
    overReceiptTolerance: 0.1,
    isActive: true,
    ...overrides,
  };
}

/** Identity a component test runs as unless it seeds its own context. */
export const COMPONENT_CONTEXT: {
  tenantId: string;
  companyId: string;
  userId: string;
  roles: string[];
  defaultCurrency: string;
  autoApproveThreshold: number;
  overReceiptTolerance: number;
} = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
  autoApproveThreshold: 1000,
  overReceiptTolerance: 0.1,
};

export type ComponentContext = Partial<typeof COMPONENT_CONTEXT>;

/**
 * Platform providers every component test registers by default. A test may
 * override any of them with its own instance (e.g. a DENY ABAC adapter) by
 * passing a provider with the same token in `createComponentModule({ platform })`.
 */
export function defaultPlatformProviders(context?: ComponentContext): Provider[] {
  return [
    {
      provide: RequestContextPort,
      useValue: new InMemoryRequestContextService({ ...COMPONENT_CONTEXT, ...context }),
    },
    { provide: AbacPort, useValue: new AllowAbacPort('ALLOW') },
    { provide: CompanyConfigPort, useValue: new FakeCompanyConfigPort() },
    { provide: OutboxWriterPort, useValue: new RecordingOutboxWriter() },
    { provide: AuditPort, useValue: new RecordingAuditPort() },
    { provide: LoggerPort, useValue: new SilentLoggerPort() },
    { provide: NumberingPort, useValue: new FakeNumberingPort() },
    { provide: CachePort, useValue: new EmptyCachePort() },
    { provide: InboxPort, useValue: new NoopInboxPort() },
    { provide: RecurringExecutionPort, useValue: new NoopRecurringExecutionPort() },
    { provide: RecurringTemplatePort, useValue: new NoopRecurringTemplatePort() },
  ];
}
