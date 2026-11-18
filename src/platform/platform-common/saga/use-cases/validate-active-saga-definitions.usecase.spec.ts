import { SagaDefinitionStatus } from '../types/saga.types';
import { GOODS_RECEIPT_SAGA_EXAMPLE } from '../types/definitions/goods-receipt.example';
import { parseSagaDefinition } from '../types/saga-definition.parser';
import { SagaActionResolverPort } from '../outbound/ports/saga-action.port';
import { SagaDefinitionRepositoryPort } from '../outbound/ports/saga-definition.repository.port';
import { ValidateActiveSagaDefinitionsUseCase } from './validate-active-saga-definitions.usecase';

/**
 * Unit — flow step 9 (`CONFIG_INVALID`).
 *
 * A definition that was fine when published can rot: an action stops being
 * registered. It must be flagged INVALID (no new instances) without touching the
 * running ones, and the failure must be logged loudly enough to alert.
 */
describe('ValidateActiveSagaDefinitionsUseCase', () => {
  const body = parseSagaDefinition(GOODS_RECEIPT_SAGA_EXAMPLE);

  const record = (over: Record<string, unknown> = {}) => ({
    id: 'def-1',
    ownerModule: 'procurement',
    sagaKey: 'goods_receipt',
    version: 3,
    eventName: 'inventory.grn.created',
    eventVersion: 1,
    status: SagaDefinitionStatus.ACTIVE,
    definition: body,
    createdAt: new Date(),
    ...over,
  });

  const allActions = {
    has: () => true,
  } as unknown as SagaActionResolverPort;

  function makeSut(definitions: ReturnType<typeof record>[], actions = allActions) {
    const repository = {
      listActive: jest.fn(async () => definitions),
      markStatus: jest.fn(async () => undefined),
    };
    const useCase = new ValidateActiveSagaDefinitionsUseCase(
      repository as unknown as SagaDefinitionRepositoryPort,
      actions,
    );
    return { useCase, repository };
  }

  it('leaves executable definitions ACTIVE', async () => {
    const { useCase, repository } = makeSut([record()]);

    await expect(useCase.execute()).resolves.toEqual({ checked: 1, invalidated: [] });
    expect(repository.markStatus).not.toHaveBeenCalled();
  });

  it('flags a definition whose action is gone', async () => {
    const actions = { has: () => false } as unknown as SagaActionResolverPort;
    const { useCase, repository } = makeSut([record()], actions);

    const result = await useCase.execute();

    expect(repository.markStatus).toHaveBeenCalledWith('def-1', SagaDefinitionStatus.INVALID);
    expect(result.invalidated[0]).toEqual(
      expect.objectContaining({ sagaKey: 'goods_receipt', version: 3 }),
    );
    expect(result.invalidated[0].problems.length).toBeGreaterThan(0);
  });

  it('logs the failure at error level so it is alertable', async () => {
    const actions = { has: () => false } as unknown as SagaActionResolverPort;
    const { useCase } = makeSut([record()], actions);
    const error = jest.spyOn(useCase['logger'], 'error');

    await useCase.execute();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('flagged INVALID'));
  });

  it('checks every active definition', async () => {
    const { useCase, repository } = makeSut([
      record(),
      record({ id: 'def-2', sagaKey: 'po_approval', version: 1 }),
    ]);

    await expect(useCase.execute()).resolves.toEqual({ checked: 2, invalidated: [] });
    expect(repository.listActive).toHaveBeenCalledTimes(1);
  });
});
