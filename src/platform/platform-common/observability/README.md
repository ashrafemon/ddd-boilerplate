# platform/observability — Logs, metrics, error tracking

> Structural logging, Prometheus metrics + a scrape endpoint, and Sentry
> error capture — behind three ports so nothing depends on the vendors.

## What it does

- `LoggerPort` (console adapter): leveled `debug/info/warn/error/fatal` with
  a `LogFields` object (JSON-stringified).
- `MetricsPort` (Prometheus adapter): `registerCounter/Gauge/Histogram` then
  `incrementCounter/observeHistogram/setGauge`; a `GET /api/v1/metrics`
  (`@SkipTenancy()`) renders the exposition. Default metric prefix `erp_`,
  default label `app=erp-api`, request/tenant labels expected from callers
  (CLS is NOT auto-attached here — see gotchas).
- `ErrorTrackingPort` (Sentry adapter): `captureException/captureMessage`;
  self-disables without `SENTRY_DSN`.

## Public API
```ts
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { MetricsPort } from '@platform/observability/ports/metrics.port';
import { ErrorTrackingPort } from '@platform/observability/ports/error-tracking.port';
```

## Layout / bindings / config
`ports/` (three), `adapters/` (three, all `useClass`), `http/metrics.controller.ts`,
`observability.module.ts`. Config `observability.sentry` (`observability.config.ts`);
Sentry.init itself runs from the bootstrap layer, not the adapter. No tables.

## Who calls it / how called
`LoggerPort`: notification adapters + the two recurring-generate business
use cases. `MetricsPort`: only the internal `/metrics` controller (counter
registration is otherwise unused — incrementing an unregistered metric is a
silent no-op). `ErrorTrackingPort`: **zero** consumers today (bound but not
injected; the global exception filter is the natural place to wire it).

## Rules & gotchas
- Register a metric before incrementing or the value is dropped.
- The ports' doc comments promise CLS auto-decorrelation; the console adapter
  doesn't do it — pass fields explicitly (or wire CLS in the adapter and
  update this README).
- `PrometheusMetricsAdapter.getRegistry()` is beyond the port; inject it
  directly only if prom-client must be reached.
