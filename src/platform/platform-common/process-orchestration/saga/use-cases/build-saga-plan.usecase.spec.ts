import { BuildSagaPlanUseCase } from './build-saga-plan.usecase';
import { SagaDefinitionBody, SagaStepKind } from '../types/saga.types';

/**
 * Unit — the plan is where a company's configuration meets the platform default.
 *
 * Overlays only narrow: they may disable optional/standard steps, add conditions,
 * override timing and retry — never disable a required step and never add one.
 * A required capability that is missing means the saga does not exist for that
 * company (null plan), which is the difference between "not applicable" and
 * "failed".
 */

function definition(overrides: Partial<SagaDefinitionBody> = {}): SagaDefinitionBody {
  return {
    key: 'grn-to-invoice',
    version: 1,
    start: { event: { name: 'inventory.grn.created', version: 1 }, key: 'GRN:{{event.grnId}}' },
    steps: [
      { id: 'valuate', policy: 'required', do: 'inventory.valuateReceipt' },
      { id: 'notify', policy: 'optional', do: 'notification.sendReceiptNotice' },
      { id: 'wait-bill', policy: 'standard', waitFor: { name: 'ap.bill.posted', version: 1 } },
    ],
    ...overrides,
  };
}

describe('BuildSagaPlanUseCase', () => {
  const useCase = new BuildSagaPlanUseCase();

  function build(
    overrides: Parameters<BuildSagaPlanUseCase['execute']>[0] extends never
      ? never
      : Partial<Parameters<BuildSagaPlanUseCase['execute']>[0]> = {},
  ) {
    return useCase.execute({
      definition: definition(),
      overlay: null,
      features: new Set<string>(),
      settings: {},
      defaultMaxAttempts: 5,
      ...overrides,
    });
  }

  it('drops optional steps that no overlay enabled and keeps required ones', () => {
    const plan = build();

    expect(plan?.steps.map(step => step.id)).toEqual(['valuate', 'wait-bill']);
    expect(plan?.steps[0].kind).toBe(SagaStepKind.DO);
    expect(plan?.steps[1].kind).toBe(SagaStepKind.WAIT);
  });

  it('returns null when a required feature is missing', () => {
    const plan = build({
      definition: definition({ requires: ['valuation'] }),
      features: new Set<string>(),
    });

    expect(plan).toBeNull();
  });

  it('returns null when an optional-only definition has nothing left to run', () => {
    const plan = build({
      definition: definition({
        steps: [{ id: 'notify', policy: 'optional', do: 'notification.send' }],
      }),
    });

    expect(plan).toBeNull();
  });

  it('disables a standard step through the overlay but never a required one', () => {
    const plan = build({
      overlay: { steps: { 'wait-bill': { enabled: false }, valuate: { enabled: false } } },
    });

    expect(plan?.steps.map(step => step.id)).toEqual(['valuate']);
  });

  it('AND-combines overlay conditions with the definition condition', () => {
    const plan = build({
      definition: definition({
        steps: [{ id: 'valuate', policy: 'required', do: 'x', if: 'event.qty > 0' }],
      }),
      overlay: { steps: { valuate: { if: 'company.settings.costingMethod == "fifo"' } } },
    });

    expect(plan?.steps[0].if).toBe('(event.qty > 0) && (company.settings.costingMethod == "fifo")');
  });

  it('applies the retry ceiling: overlay beats definition beats default', () => {
    const plan = build({
      definition: definition({
        steps: [
          { id: 'valuate', policy: 'required', do: 'x', retry: { maxAttempts: 3 } },
          { id: 'wait-bill', policy: 'standard', waitFor: { name: 'a', version: 1 } },
        ],
      }),
      overlay: { steps: { valuate: { retry: { maxAttempts: 7 } } } },
      defaultMaxAttempts: 5,
    });

    expect(plan?.steps.map(step => step.maxAttempts)).toEqual([7, 5]);
  });

  it('returns null when the overlay switches the saga off', () => {
    expect(build({ overlay: { enabled: false } })).toBeNull();
  });
});
