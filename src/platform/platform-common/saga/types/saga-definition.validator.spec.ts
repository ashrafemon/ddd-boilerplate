import { SagaDefinitionBody } from './saga.types';
import { findDefinitionProblems } from './saga-definition.validator';

/**
 * Unit — "can the engine actually run this definition?".
 *
 * `parseSagaDefinition` only proves the document has the right shape. These are
 * the checks that keep a bad condition, an unreversible step or a broken template
 * out of `saga_definitions` (flow step 1) and let the boot sweep flag a
 * definition that broke after publishing (flow step 9).
 */
describe('findDefinitionProblems', () => {
  const base = (over: Partial<SagaDefinitionBody> = {}): SagaDefinitionBody => ({
    key: 'goods_receipt',
    version: 3,
    start: {
      event: { name: 'inventory.grn.created', version: 1 },
      key: 'GRN:{{event.grnId}}',
      context: { grnId: 'event.grnId' },
    },
    steps: [
      {
        id: 'valuate',
        policy: 'required',
        do: 'inventory.valuation.posted',
        undo: 'inventory.valuation.reversed',
        pivot: false,
      },
    ],
    ...over,
  });

  it('accepts an executable definition', () => {
    expect(findDefinitionProblems(base())).toEqual([]);
  });

  it('rejects a step whose work cannot be undone', () => {
    const definition = base({
      steps: [{ id: 'post_stock', policy: 'required', do: 'inventory.movement.posted' }],
    });

    expect(findDefinitionProblems(definition)).toEqual([
      'step "post_stock" has no compensation and is not a pivot step',
    ]);
  });

  it('allows the same step once it is a pivot', () => {
    const definition = base({
      steps: [
        {
          id: 'post_stock',
          policy: 'required',
          do: 'inventory.movement.posted',
          pivot: true,
        },
      ],
    });

    expect(findDefinitionProblems(definition)).toEqual([]);
  });

  it('rejects an unparsable condition', () => {
    const definition = base({
      steps: [
        {
          id: 'valuate',
          policy: 'required',
          do: 'inventory.valuation.posted',
          undo: 'inventory.valuation.reversed',
          if: 'company.settings.finance.grnAccrual ===',
        },
      ],
    });

    expect(findDefinitionProblems(definition)).toEqual([
      expect.stringContaining('step "valuate" if: Invalid saga expression'),
    ]);
  });

  it('rejects a broken match template', () => {
    const definition = base({
      steps: [
        { id: 'valuate', policy: 'required', do: 'a.b', undo: 'a.b.reversed' },
        {
          id: 'inspect',
          policy: 'standard',
          waitFor: { name: 'quality.inspection.completed', version: 1 },
          match: 'GRN:{{event.grnId ==}}',
        },
      ],
    });

    expect(findDefinitionProblems(definition)).toEqual([
      expect.stringContaining('step "inspect" match: Invalid saga expression'),
    ]);
  });

  it('rejects a WAIT without a match template', () => {
    const definition = base({
      steps: [
        { id: 'valuate', policy: 'required', do: 'a.b', undo: 'a.b.reversed' },
        {
          id: 'inspect',
          policy: 'standard',
          waitFor: { name: 'quality.inspection.completed', version: 1 },
        },
      ],
    });

    expect(findDefinitionProblems(definition)).toEqual([
      'step "inspect" waits for an event without a match template',
    ]);
  });

  it('rejects a bad ISO-8601 duration', () => {
    const definition = base({
      steps: [
        { id: 'valuate', policy: 'required', do: 'a.b', undo: 'a.b.reversed' },
        {
          id: 'inspect',
          policy: 'standard',
          waitFor: { name: 'q.i.c', version: 1 },
          match: 'GRN:{{event.grnId}}',
          timeout: '7 days',
        },
      ],
    });

    expect(findDefinitionProblems(definition)).toEqual([
      expect.stringContaining('step "inspect" timeout: Invalid ISO-8601 duration'),
    ]);
  });

  it('rejects unregistered actions when a probe is supplied', () => {
    const probe = { has: (name: string) => name === 'inventory.valuation.posted' };
    const definition = base({
      steps: [
        {
          id: 'valuate',
          policy: 'required',
          do: 'inventory.valuation.posted',
          undo: 'inventory.valuation.reversed',
        },
      ],
    });

    expect(findDefinitionProblems(definition, probe)).toEqual([
      'step "valuate" compensation "inventory.valuation.reversed" is not registered',
    ]);
  });

  it('rejects a plan that could never execute anything', () => {
    const definition = base({
      steps: [
        {
          id: 'inspect',
          policy: 'standard',
          waitFor: { name: 'q.i.c', version: 1 },
          match: 'GRN:{{event.grnId}}',
        },
      ],
    });

    expect(findDefinitionProblems(definition)).toEqual([
      'definition has no action step — nothing would ever execute',
    ]);
  });
});
