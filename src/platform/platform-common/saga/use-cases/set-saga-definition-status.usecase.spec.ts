import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaSagaDefinitionRepository } from '../repositories/prisma-saga-definition.repository';
import { SagaDefinitionStatus } from '../types/saga.types';
import { GOODS_RECEIPT_SAGA_EXAMPLE } from '../types/definitions/goods-receipt.example';
import { parseSagaDefinition } from '../types/saga-definition.parser';
import { SetSagaDefinitionStatusUseCase } from './set-saga-definition-status.usecase';

/**
 * Unit — status flips are the retirement/revival path for a runtime definition.
 *
 * Activation re-validates the stored body, so a broken definition cannot be
 * revived by a flag; retirement never touches the body, so running instances keep
 * their snapshot.
 */
describe('SetSagaDefinitionStatusUseCase', () => {
  const body = parseSagaDefinition(GOODS_RECEIPT_SAGA_EXAMPLE);

  function makeSut(record: { id: string; definition: unknown; status: string } | null) {
    const definitions = {
      findById: jest.fn(async () => record),
      markStatus: jest.fn(async () => undefined),
    };
    const useCase = new SetSagaDefinitionStatusUseCase(
      definitions as unknown as PrismaSagaDefinitionRepository,
    );
    return { useCase, definitions };
  }

  const record = {
    id: 'def-1',
    sagaKey: 'goods_receipt',
    version: 3,
    definition: body,
    status: SagaDefinitionStatus.INVALID,
  };

  it('rejects an unknown definition', async () => {
    const { useCase } = makeSut(null);

    await expect(
      useCase.execute({ definitionId: 'nope', status: SagaDefinitionStatus.RETIRED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('retires a definition without touching the body', async () => {
    const { useCase, definitions } = makeSut(record);

    const updated = await useCase.execute({
      definitionId: 'def-1',
      status: SagaDefinitionStatus.RETIRED,
    });

    expect(definitions.markStatus).toHaveBeenCalledWith('def-1', SagaDefinitionStatus.RETIRED);
    expect(updated.status).toBe(SagaDefinitionStatus.RETIRED);
  });

  it('activates a definition whose stored body still executes', async () => {
    const { useCase, definitions } = makeSut(record);

    await useCase.execute({ definitionId: 'def-1', status: SagaDefinitionStatus.ACTIVE });

    expect(definitions.markStatus).toHaveBeenCalledWith('def-1', SagaDefinitionStatus.ACTIVE);
  });

  it('refuses to activate a broken body — a corrected version is required', async () => {
    const broken = { ...body, steps: [{ ...body.steps[0], do: 'missing.action', undo: null }] };
    const { useCase } = makeSut({ ...record, definition: broken });

    await expect(
      useCase.execute({ definitionId: 'def-1', status: SagaDefinitionStatus.ACTIVE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
