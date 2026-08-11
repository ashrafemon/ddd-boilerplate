const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'coverage') continue;
      walk(full);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
})(ROOT);

// Ordered replacements: longest/most specific first.
const REPLACEMENTS = [
  ['shared-kernel/domains/identifier', 'shared-business/domain/identifier'],
  ['shared-kernel/domains/organization-id', 'shared-business/value-object/organization-id'],
  ['shared-kernel/domains/tenant-id', 'shared-business/value-object/tenant-id'],
  ['shared-kernel/events/domain-event', 'shared-business/event/domain-event'],
  ['business/product/domain/port/outbox.port', 'shared-kernel/port/outbox/outbox.port'],
  ['business/vendor/domain/port/outbox.port', 'shared-kernel/port/outbox/outbox.port'],
  ['business/purchase/domain/port/outbox.port', 'shared-kernel/port/outbox/outbox.port'],
  ['platform/messaging/integration-event-handler.port', 'shared-kernel/port/messaging/integration-event-handler.port'],
  ['platform/messaging/message-publisher.port', 'shared-kernel/port/messaging/message-publisher.port'],
  ['platform/messaging/integration-message-processor.service', 'platform/messaging/integration-message-processor.service'],
  ['platform/messaging/integration-message-router', 'platform/messaging/integration-message-router'],
  ['platform/messaging/integration-message', 'shared-kernel/port/messaging/integration-message'],
  ['shared-kernel/port/messaging/integration-message-processor.service', 'platform/messaging/integration-message-processor.service'],
  ['shared-kernel/port/messaging/integration-message-router', 'platform/messaging/integration-message-router'],
  ['platform/outbox/outbox-read-store.port', 'shared-kernel/port/outbox/outbox-read-store.port'],
  ['platform/outbox/outbox.port', 'shared-kernel/port/outbox/outbox.port'],
  ['platform/configuration/organization-configuration.port', 'shared-kernel/port/configuration/organization-configuration.port'],
  ['platform/context/request-context.port', 'shared-kernel/port/context/request-context.port'],
  ['platform/context/request-context.middleware', 'platform/context/request-context.middleware'],
  ['shared-kernel/port/context/request-context.middleware', 'platform/context/request-context.middleware'],
  ['shared-business/value-object/tenant-id', 'shared-kernel/domain/tenant-id'],
  ['shared-business/value-object/organization-id', 'shared-kernel/domain/organization-id'],
  ['shared-business/domain/identifier', 'shared-kernel/domain/identifier'],
  ['shared-business/event/domain-event', 'shared-kernel/event/domain-event'],
  ['platform/event-bus/event-bus.port', 'shared-kernel/port/event-bus/event-bus.port'],
  ['platform/tenant/tenant-resolver.port', 'shared-kernel/port/tenant/tenant-resolver.port'],
  ['platform/tenant/tenant-repository.port', 'shared-kernel/port/tenant/tenant-repository.port'],
  ['platform/organization/organization-resolver.port', 'shared-kernel/port/organization/organization-resolver.port'],
  ['platform/organization/organization-repository.port', 'shared-kernel/port/organization/organization-repository.port'],
  ['platform/idempotency/inbox.port', 'shared-kernel/port/idempotency/inbox.port'],
  ['platform/cache/cache.port', 'shared-kernel/port/cache/cache.port'],
  ['platform/cache/cache-key', 'shared-kernel/utility/cache-key'],
  ['platform/notification/email.port', 'shared-kernel/port/notification/email.port'],
  ['platform/notification/notification.port', 'shared-kernel/port/notification/notification.port'],
  ['platform/storage/file-storage.port', 'shared-kernel/port/storage/file-storage.port'],
  ['shared-kernel/port/logger.port', 'shared-kernel/port/observability/logger.port'],
  ['shared-kernel/port/metrics.port', 'shared-kernel/port/observability/metrics.port'],
  ['shared-kernel/port/error-tracking.port', 'shared-kernel/port/observability/error-tracking.port'],
  ['platform/observability/error-tracking.port', 'shared-kernel/port/observability/error-tracking.port'],
  ['platform/observability/logger.port', 'shared-kernel/port/observability/logger.port'],
  ['platform/observability/metrics.port', 'shared-kernel/port/observability/metrics.port'],
  ['shared-kernel/context/request-context.port', 'platform/context/request-context.port'],
  ['shared-kernel/context/request-context.service', 'infrastructure/context/cls-request-context.service'],
  ['shared-kernel/logging/logger.port', 'platform/observability/logger.port'],
  ['shared-kernel/logging/pino-logger.adapter', 'infrastructure/observability/pino-logger.adapter'],
  ['shared-kernel/logging/console-logger.adapter', 'infrastructure/observability/console-logger.adapter'],
  ['shared-kernel/observability/metrics.port', 'platform/observability/metrics.port'],
  ['shared-kernel/observability/error-tracking.port', 'platform/observability/error-tracking.port'],
  ['shared-kernel/observability/loki-logger.adapter', 'infrastructure/observability/loki-logger.adapter'],
  ['shared-kernel/observability/prometheus-metrics.adapter', 'infrastructure/observability/prometheus-metrics.adapter'],
  ['shared-kernel/observability/sentry-error-tracking.adapter', 'infrastructure/observability/sentry-error-tracking.adapter'],
  ['shared-kernel/event-bus/event-bus.port', 'platform/event-bus/event-bus.port'],
  ['shared-kernel/event-bus/event-emitter-bus.adapter', 'infrastructure/event-bus/event-emitter-bus.adapter'],
  ['shared-kernel/middleware/request-context.middleware', 'infrastructure/context/request-context.middleware'],
  ['shared-kernel/filter/global-exception.filter', 'platform/http/filter/global-exception.filter'],
  ['shared-kernel/guard/auth.guard', 'platform/http/guard/auth.guard'],
  ['shared-kernel/guard/roles.guard', 'platform/http/guard/roles.guard'],
  ['shared-kernel/interceptor/correlation.interceptor', 'platform/http/interceptor/correlation.interceptor'],
  ['shared-kernel/interceptor/logging.interceptor', 'platform/http/interceptor/logging.interceptor'],
  ['shared-kernel/interceptor/request-context.interceptor', 'platform/http/interceptor/request-context.interceptor'],
  ['shared-kernel/interceptor/response.interceptor', 'platform/http/interceptor/response.interceptor'],
  ['shared-kernel/interceptor/timeout.interceptor', 'platform/http/interceptor/timeout.interceptor'],
  ['shared-kernel/decorator/current-context.decorator', 'platform/http/decorator/current-context.decorator'],
  ['shared-kernel/decorator/public.decorator', 'platform/http/decorator/public.decorator'],
  ['shared-kernel/decorator/roles.decorator', 'platform/http/decorator/roles.decorator'],
  ['shared-kernel/port/integration-event-handler.port', 'platform/messaging/integration-event-handler.port'],
  ['shared-kernel/port/integration-message', 'platform/messaging/integration-message'],
  ['shared-kernel/port/message-publisher.port', 'platform/messaging/message-publisher.port'],
  ['shared-kernel/port/outbox-read-store.port', 'platform/outbox/outbox-read-store.port'],
  ['shared-kernel/port/file-storage.port', 'platform/storage/file-storage.port'],
  ['shared-kernel/port/notification.port', 'platform/notification/notification.port'],
  ['shared-kernel/port/cache.port', 'platform/cache/cache.port'],
  ['shared-kernel/port/email.port', 'platform/notification/email.port'],
  ['shared-kernel/port/inbox.port', 'platform/idempotency/inbox.port'],
  ['shared-kernel/port/outbox.port', 'platform/outbox/outbox.port'],
  ['shared-kernel/config/', 'config/'],
  ['infrastructure/messaging/integration-message-processor.service', 'platform/messaging/integration-message-processor.service'],
  ['infrastructure/messaging/integration-message-router', 'platform/messaging/integration-message-router'],
  ['infrastructure/messaging/messaging.constants', 'platform/messaging/messaging.constants'],
  ['infrastructure/messaging/messaging-core.module', 'platform/messaging/messaging-core.module'],
  ['infrastructure/messaging/messaging.module', 'platform/messaging/messaging.module'],
  ['infrastructure/messaging/composite-message-publisher', 'platform/messaging/composite-message-publisher'],
  ['infrastructure/outbox/outbox-dispatcher.service', 'platform/outbox/outbox-dispatcher.service'],
  ['infrastructure/organization/', 'platform/organization/'],
  ['infrastructure/tenant/', 'platform/tenant/'],
  ['infrastructure/saga/', 'platform/saga/'],
  ['infrastructure/workflow/', 'platform/workflow/'],
  ['infrastructure/health/', 'platform/health/'],
];

let changed = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let next = original;
  for (const [from, to] of REPLACEMENTS) {
    next = next.split(from).join(to);
  }
  if (next !== original) {
    fs.writeFileSync(file, next);
    changed++;
  }
}

console.log(`Updated path segments in ${changed} files`);
