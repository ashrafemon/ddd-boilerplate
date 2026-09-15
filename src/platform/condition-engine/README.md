# platform/condition-engine — Declarative generation gate

> Evaluates a stored AND/OR `GenerationCondition` tree against resolved field
> values, sandboxed (no dynamic code), to decide whether a recurring
> occurrence should generate a document.

## What it does

`ConditionEvaluator.evaluate(condition, context)` walks the parsed condition
(`GenerationConditionParser.parse(json)`) applying operators `eq neq gt gte
lt lte in notIn` to **FieldResolver**s fetched from `FieldResolverRegistry`
by the dotted field's first segment prefix. Returns
`{ passed, evaluatedValues }`. Duplicate prefix registration throws at boot;
a non-orderable comparison evaluates `false`; unknown operator throws. Null
condition semantics are the caller's ("no condition ⇒ pass" is decided
upstream) — the engine never invents them.

## Public API
```ts
import { ConditionEvaluator } from '@platform/condition-engine/ports/condition-evaluator.port';
import { FieldResolverRegistry, FieldResolver } from '@platform/condition-engine/.../field-resolver.registry';
registry.register('invoice', myInvoiceFieldResolver);       // owned by the field's module
const { passed } = await evaluator.evaluate(cond, { tenantId, traceId });
```

## Layout / bindings
`ports/condition-evaluator.port.ts`, `generation-condition.parser.ts`,
`services/condition-evaluation.service.ts`, `field-resolver.registry.ts`
(both exported, no separate tokens), `condition-engine.module.ts`
(evaluator `useExisting`; registry provided directly). No tables, no config.

## Who calls it / how called
`platform/recurring` (`recurring-generation.handler.ts`) is the only
consumer, injecting the evaluator and calling the parser statically.
Resolvers follow the §9.1 standard: the field-owning module ships a PURE
`FieldResolver` (no lifecycle hooks, no registry imports) and the
composition root registers it via a bridge row (`src/bootstrap/configure-*.ts`),
same as `configure-batch-operations.ts` does for batch handlers.

## Tenancy & Gotchas (important)
- **No production code registers any FieldResolver today** (only spec files
  call `register()`). So any non-trivial generation condition currently
  throws `No FieldResolver registered for field '<field>'`. Before using
  conditions on a template, the owning module must register a resolver for
  every prefix its condition references — see the recurring README.
- `EvaluationContext.traceId` is required (`RecurringContext` satisfies the
  shape without importing it).
