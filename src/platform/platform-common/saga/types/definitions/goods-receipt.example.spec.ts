import { BuildSagaPlanUseCase } from '../../use-cases/build-saga-plan.usecase';
import { SagaPlanStep, SagaStepKind } from '../saga.types';
import { parseSagaDefinition } from '../saga-definition.parser';
import { GOODS_RECEIPT_SAGA_EXAMPLE } from './goods-receipt.example';

/**
 * Unit — the workbook's reference saga must plan exactly as the sheet describes.
 *
 * `8-Saga` flow step 2: the plan drops optional/standard steps whose features are
 * missing and refuses the saga entirely when a required one is missing. This spec
 * keeps the sheet and the running definition in lockstep.
 */
describe('goods_receipt saga definition (workbook mock)', () => {
  const builder = new BuildSagaPlanUseCase();

  const build = (features: string[]) =>
    builder.execute({
      definition: parseSagaDefinition(GOODS_RECEIPT_SAGA_EXAMPLE),
      overlay: null,
      features: new Set(features),
      settings: {},
      defaultMaxAttempts: 3,
    });

  const ids = (steps: SagaPlanStep[]) => steps.map(step => step.id);

  it('plans the four steps when every feature is enabled', () => {
    const plan = build([
      'inventory.valuation',
      'inventory.stock_ledger',
      'finance',
      'quality.inspection',
    ]);

    expect(plan).not.toBeNull();
    expect(ids(plan!.steps)).toEqual(['valuate', 'post_stock', 'accrue', 'inspect']);
    expect(plan!.steps.map(step => step.kind)).toEqual([
      SagaStepKind.DO,
      SagaStepKind.DO,
      SagaStepKind.DO,
      SagaStepKind.WAIT,
    ]);
  });

  it('keeps the WAIT contract from the sheet', () => {
    const plan = build(['inventory.valuation', 'inventory.stock_ledger', 'quality.inspection']);
    const inspect = plan!.steps.find(step => step.id === 'inspect');

    expect(inspect).toEqual(
      expect.objectContaining({
        waitFor: { name: 'quality.inspection.completed', version: 1 },
        match: 'GRN:{{event.grnId}}',
        if: 'saga.hasQcItems == true',
        timeout: 'P7D',
        onTimeout: 'skip',
      }),
    );
  });

  it('carries the compensation of every DO step', () => {
    const plan = build(['inventory.valuation', 'inventory.stock_ledger', 'finance']);

    expect(plan!.steps.map(step => step.undo)).toEqual([
      'inventory.valuation.reversed',
      'inventory.movement.reversed',
      'finance.accrual.reversed',
      undefined,
    ]);
    expect(plan!.steps.find(step => step.id === 'post_stock')?.input).toEqual({
      unitCosts: 'steps.valuate.output.unitCosts',
    });
  });

  it('drops the standard steps whose features are missing', () => {
    const plan = build(['inventory.valuation', 'inventory.stock_ledger']);

    expect(ids(plan!.steps)).toEqual(['valuate', 'post_stock']);
  });

  it('produces no saga when a required feature is missing', () => {
    expect(build(['inventory.valuation', 'finance'])).toBeNull();
    expect(build(['inventory.stock_ledger', 'finance'])).toBeNull();
    expect(build([])).toBeNull();
  });

  it('publishes the completion event from the sheet', () => {
    const plan = build(['inventory.valuation', 'inventory.stock_ledger']);

    expect(plan!.onComplete).toEqual({ emit: 'inventory.grn.posted' });
    expect(plan!.sagaKey).toBe('goods_receipt');
    expect(plan!.version).toBe(3);
  });
});
