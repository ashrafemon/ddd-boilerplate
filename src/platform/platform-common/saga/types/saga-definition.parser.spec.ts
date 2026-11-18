import { SagaDefinitionValidationError, parseSagaDefinition } from './saga-definition.parser';
import { SagaDefinitionDocument } from './saga-definition.document';

/**
 * Unit — the published document → canonical body.
 *
 * The workbook authors definitions with `action`/`compensation` pairs, explicit
 * `kind`, upper-case enums and `acceptedEventCondition`; the runtime wants the
 * canonical body. Normalising once, at publish time, is what keeps one shape in
 * `saga_definitions`.
 */
describe('parseSagaDefinition', () => {
  const MINIMAL: SagaDefinitionDocument = {
    key: 'goods_receipt',
    version: 3,
    start: {
      event: { name: 'inventory.grn.created', version: 1 },
      key: 'GRN:{{event.grnId}}',
    },
    steps: [
      {
        id: 'valuate',
        kind: 'DO',
        policy: 'REQUIRED',
        action: { name: 'inventory.valuation.posted', version: 1 },
        compensation: { name: 'inventory.valuation.reversed', version: 1 },
      },
    ],
  };

  it('normalises the workbook step vocabulary', () => {
    const body = parseSagaDefinition({
      ...MINIMAL,
      steps: [
        {
          id: 'valuate',
          kind: 'DO',
          policy: 'REQUIRED',
          action: { name: 'inventory.valuation.posted', version: 1 },
          compensation: { name: 'inventory.valuation.reversed', version: 1 },
          retryPolicy: 'standard',
        },
        {
          id: 'inspect',
          kind: 'WAIT',
          policy: 'STANDARD',
          waitFor: { name: 'quality.inspection.completed', version: 1 },
          match: 'GRN:{{event.grnId}}',
          timeout: 'P7D',
          onTimeout: 'SKIP',
          acceptedEventCondition: "event.status == 'PASSED'",
        },
      ],
      onComplete: { emit: { name: 'inventory.grn.posted', version: 1 } },
    });

    expect(body.key).toBe('goods_receipt');
    expect(body.start.key).toBe('GRN:{{event.grnId}}');
    expect(body.steps[0]).toEqual({
      id: 'valuate',
      policy: 'required',
      do: 'inventory.valuation.posted',
      undo: 'inventory.valuation.reversed',
      input: undefined,
      waitFor: undefined,
      match: undefined,
      when: undefined,
      requires: undefined,
      if: undefined,
      timeout: undefined,
      onTimeout: undefined,
      retry: undefined,
      pivot: false,
    });
    // WAIT: acceptedEventCondition becomes the per-event filter, SKIP lowercased.
    expect(body.steps[1]).toEqual(
      expect.objectContaining({
        policy: 'standard',
        do: undefined,
        when: "event.status == 'PASSED'",
        onTimeout: 'skip',
        timeout: 'P7D',
      }),
    );
    // `onComplete.emit` is stored as the event name, not the ref object.
    expect(body.onComplete).toEqual({ emit: 'inventory.grn.posted' });
  });

  it('accepts the bare-name aliases and infers the step kind', () => {
    const body = parseSagaDefinition({
      ...MINIMAL,
      steps: [
        { id: 'valuate', policy: 'required', do: 'inventory.valuation.posted' },
        {
          id: 'inspect',
          policy: 'standard',
          waitFor: { name: 'quality.inspection.completed', version: 1 },
        },
      ],
    });

    expect(body.steps[0].do).toBe('inventory.valuation.posted');
    expect(body.steps[1].when).toBeUndefined();
    expect(body.steps[1].onTimeout).toBeUndefined();
  });

  it('maps a named retry profile to an attempt override', () => {
    const body = parseSagaDefinition({
      ...MINIMAL,
      steps: [{ ...MINIMAL.steps[0], retryPolicy: 'aggressive' }],
    });

    expect(body.steps[0].retry).toEqual({ maxAttempts: 5 });
  });

  it('keeps the cancellation contracts', () => {
    const body = parseSagaDefinition({
      ...MINIMAL,
      cancelOn: [{ name: 'inventory.grn.cancelled', version: 1 }],
    });

    expect(body.cancelOn).toEqual([{ name: 'inventory.grn.cancelled', version: 1 }]);
  });

  it.each([
    ['a missing key', { ...MINIMAL, key: ' ' }, /definition key/],
    ['a broken version', { ...MINIMAL, version: 0 }, /definition version/],
    ['a missing start', { ...MINIMAL, start: undefined }, /start block/],
    ['a missing start key', { ...MINIMAL, start: { ...MINIMAL.start, key: '' } }, /start\.key/],
    ['no steps', { ...MINIMAL, steps: [] }, /at least one step/],
    [
      'a duplicate step id',
      { ...MINIMAL, steps: [MINIMAL.steps[0], MINIMAL.steps[0]] },
      /repeats step id/,
    ],
    [
      'an unknown policy',
      { ...MINIMAL, steps: [{ ...MINIMAL.steps[0], policy: 'WHENEVER' }] },
      /unknown policy/,
    ],
    [
      'an unknown kind',
      { ...MINIMAL, steps: [{ ...MINIMAL.steps[0], kind: 'SLEEP' }] },
      /unknown kind/,
    ],
    [
      'a WAIT without waitFor',
      { ...MINIMAL, steps: [{ id: 'inspect', kind: 'WAIT', policy: 'STANDARD' }] },
      /needs a waitFor event/,
    ],
    [
      'a DO without an action',
      { ...MINIMAL, steps: [{ id: 'valuate', kind: 'DO', policy: 'REQUIRED' }] },
      /needs an action/,
    ],
    [
      'an ambiguous WAIT filter',
      {
        ...MINIMAL,
        steps: [
          {
            id: 'inspect',
            kind: 'WAIT',
            waitFor: { name: 'quality.inspection.completed', version: 1 },
            when: 'event.status == 1',
            acceptedEventCondition: 'event.status == 2',
          },
        ],
      },
      /both when and acceptedEventCondition/,
    ],
    [
      'an unknown timeout policy',
      {
        ...MINIMAL,
        steps: [
          {
            id: 'inspect',
            kind: 'WAIT',
            waitFor: { name: 'quality.inspection.completed', version: 1 },
            onTimeout: 'REVERSE',
          },
        ],
      },
      /unknown onTimeout/,
    ],
    [
      'an unknown retry profile',
      { ...MINIMAL, steps: [{ ...MINIMAL.steps[0], retryPolicy: 'yolo' }] },
      /unknown retryPolicy/,
    ],
  ])('rejects %s', (_label, document, message) => {
    expect(() => parseSagaDefinition(document as SagaDefinitionDocument)).toThrow(
      SagaDefinitionValidationError,
    );
    expect(() => parseSagaDefinition(document as SagaDefinitionDocument)).toThrow(message);
  });
});
