# platform/numbering — Document sequence generator

> Hands out gap-tolerant, race-safe, per-tenant document numbers (e.g.
> `PO-000042`, `IMP-000001`, `BATCH-000007`).

## What it does

`NumberingPort.nextNumber(key, {prefix, padding})` runs a single
`upsert` on `number_sequences` keyed by a **tenant/company-namespaced**
key (`${organizationId ?? tenantId}:${key}` from CLS) — so no read-then-write
window, no double-issued number, and each company gets its own independent
stream. `prefix`/`padding` freeze when a sequence is first created; `padding`
zero-pads, default 0. First value = 1.

## Public API

```ts
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
const docNo = await this.numbering.nextNumber('purchase-order', { prefix: 'PO-', padding: 6 });
```

## Layout / bindings / tables
`ports/numbering.port.ts`, `repositories/numbering.repository.ts`,
`numbering.module.ts` (imports `ContextModule`). Table `number_sequences`
(BigInt `currentValue`). No config file.

## Who calls it / how called
`platform/import` (IMP- no), `platform/batch-operation` (BATCH- no);
`purchase-order` + `invoice` through a module-local port + `NumberingAdapter`
(`useExisting` chain via `PlatformModule`).

## Tenancy & gotchas
- Numbering reads the scope off the CLS context, so callers that run in
  background paths must restore context first (`RequestContextPort.run`) —
  the scheduler/import workers do.
- Gaps are allowed (a rolled-back txn still consumed its number); uniqueness
  is guaranteed, density is not.
- Never invent a document number in business code — request it here.
