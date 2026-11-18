import { SagaDefinitionDocument } from '../saga-definition.document';

/**
 * `goods_receipt` v3 — the workbook's **mock** definition, kept as an example.
 *
 * This file is NOT shipped and NOT seeded: saga definitions are runtime data,
 * published through `POST /saga/definitions` and stored in `saga_definitions`.
 * The document is transcribed from `docs/erp-system/Common Services.xlsx`
 * (`DB Tables` sheet, `saga_definitions` example row) only so tests, docs and the
 * parser have one realistic document in the published format
 * (`action`/`compensation` pairs, explicit `kind`, `acceptedEventCondition`) —
 * `parseSagaDefinition` normalises it exactly as it would a published one.
 *
 * Reading it against the plan builder:
 *   - `requires` gates the whole saga on two inventory features — a company
 *     without them gets no instance at all.
 *   - `valuate` and `post_stock` are REQUIRED, so a company missing
 *     `inventory.valuation` / `inventory.stock_ledger` produces no saga either.
 *   - `accrue` (STANDARD + `finance`) and `inspect` (STANDARD + `quality.inspection`)
 *     drop out of the plan when those features are absent, and are overridable
 *     per company (overlays only narrow).
 *   - `inspect` is the WAIT: it matches on the GRN correlation key, accepts only
 *     `event.status == 'PASSED'`, and skips after 7 days instead of compensating.
 *   - `if` conditions are not resolved at plan time — the router evaluates them
 *     when the step is reached, so a bypass continues the plan.
 */
export const GOODS_RECEIPT_SAGA_EXAMPLE = {
  key: 'goods_receipt',
  version: 3,
  requires: ['inventory.valuation', 'inventory.stock_ledger'],
  start: {
    event: { name: 'inventory.grn.created', version: 1 },
    key: 'GRN:{{event.grnId}}',
    context: {
      grnId: 'event.grnId',
      hasQcItems: 'event.hasQcItems',
      hasValue: 'event.totalValue != null',
      sourceType: 'event.source.type',
    },
  },
  steps: [
    {
      id: 'valuate',
      kind: 'DO',
      policy: 'REQUIRED',
      action: { name: 'inventory.valuation.posted', version: 1 },
      compensation: { name: 'inventory.valuation.reversed', version: 1 },
      requires: ['inventory.valuation'],
      retryPolicy: 'standard',
    },
    {
      id: 'post_stock',
      kind: 'DO',
      policy: 'REQUIRED',
      action: { name: 'inventory.movement.posted', version: 1 },
      compensation: { name: 'inventory.movement.reversed', version: 1 },
      requires: ['inventory.stock_ledger'],
      input: { unitCosts: 'steps.valuate.output.unitCosts' },
      retryPolicy: 'standard',
    },
    {
      id: 'accrue',
      kind: 'DO',
      policy: 'STANDARD',
      action: { name: 'finance.accrual.posted', version: 1 },
      compensation: { name: 'finance.accrual.reversed', version: 1 },
      requires: ['finance'],
      if: "company.settings.finance.grnAccrual == true && (steps.valuate.status == 'DONE' || saga.hasValue == true)",
      retryPolicy: 'standard',
    },
    {
      id: 'inspect',
      kind: 'WAIT',
      policy: 'STANDARD',
      waitFor: { name: 'quality.inspection.completed', version: 1 },
      match: 'GRN:{{event.grnId}}',
      requires: ['quality.inspection'],
      if: 'saga.hasQcItems == true',
      timeout: 'P7D',
      onTimeout: 'SKIP',
      acceptedEventCondition: "event.status == 'PASSED'",
    },
  ],
  onComplete: {
    emit: { name: 'inventory.grn.posted', version: 1 },
  },
} satisfies SagaDefinitionDocument;
