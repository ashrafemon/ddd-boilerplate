import { BadRequestException } from '@nestjs/common';
import { SagaDefinitionStatus } from '../types/saga.types';
import { SagaDefinitionDocument } from '../types/saga-definition.document';
import { GOODS_RECEIPT_SAGA_EXAMPLE } from '../types/definitions/goods-receipt.example';
import { SagaDefinitionRepositoryPort } from '../outbound/ports/saga-definition.repository.port';
import { RegisterSagaDefinitionUseCase } from './register-saga-definition.usecase';

/**
 * Unit — publishing a definition (workbook `8-Saga` flow step 1).
 *
 * A publish validates first and rejects an invalid body, writes a new
 * `(sagaKey, version)` row otherwise, and never mutates an existing version:
 * running instances keep the plan snapshot they started with, so a config change
 * can only reach new instances.
 */
describe('RegisterSagaDefinitionUseCase', () => {
  function makeSut(existing: { id: string } | null = null) {
    const definitions = {
      findByKeyVersion: jest.fn(async () => existing),
      create: jest.fn(async (input: { sagaKey: string; definition: { version: number } }) => ({
        id: 'def-1',
        sagaKey: input.sagaKey,
        version: input.definition.version,
        status: SagaDefinitionStatus.ACTIVE,
      })),
    };
    const useCase = new RegisterSagaDefinitionUseCase(
      definitions as unknown as SagaDefinitionRepositoryPort,
    );
    return { useCase, definitions };
  }

  it('registers the workbook definition as an ACTIVE row', async () => {
    const { useCase, definitions } = makeSut();

    await expect(
      useCase.execute({ document: GOODS_RECEIPT_SAGA_EXAMPLE, ownerModule: 'procurement' }),
    ).resolves.toEqual({
      registered: true,
      sagaKey: 'goods_receipt',
      version: 3,
      definitionId: 'def-1',
    });

    expect(definitions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sagaKey: 'goods_receipt',
        ownerModule: 'procurement',
        status: SagaDefinitionStatus.ACTIVE,
        createdBy: 'platform',
      }),
    );
    // The stored body is the normalised one, not the published document.
    const stored = definitions.create.mock.calls[0][0] as unknown as {
      definition: { steps: { do?: string }[] };
    };
    expect(stored.definition.steps[0].do).toBe('inventory.valuation.posted');
  });

  it('is idempotent for an already published version', async () => {
    const { useCase, definitions } = makeSut({ id: 'def-existing' });

    await expect(useCase.execute({ document: GOODS_RECEIPT_SAGA_EXAMPLE })).resolves.toEqual({
      registered: false,
      sagaKey: 'goods_receipt',
      version: 3,
      definitionId: 'def-existing',
    });

    expect(definitions.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid definition as a client error', async () => {
    const { useCase, definitions } = makeSut();
    const invalid = {
      ...GOODS_RECEIPT_SAGA_EXAMPLE,
      steps: [{ id: 'valuate', kind: 'DO', policy: 'REQUIRED' }],
    } as SagaDefinitionDocument;

    await expect(useCase.execute({ document: invalid })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(definitions.findByKeyVersion).not.toHaveBeenCalled();
    expect(definitions.create).not.toHaveBeenCalled();
  });

  it('rejects a definition whose work cannot be undone', async () => {
    const { useCase, definitions } = makeSut();
    const document = {
      ...GOODS_RECEIPT_SAGA_EXAMPLE,
      steps: [
        {
          id: 'post_stock',
          kind: 'DO',
          policy: 'REQUIRED',
          action: { name: 'inventory.movement.posted', version: 1 },
        },
      ],
    } as SagaDefinitionDocument;

    await expect(useCase.execute({ document })).rejects.toThrow(
      /no compensation and is not a pivot step/,
    );
    expect(definitions.create).not.toHaveBeenCalled();
  });

  it('rejects a definition with an unparsable condition', async () => {
    const { useCase, definitions } = makeSut();
    const document = {
      ...GOODS_RECEIPT_SAGA_EXAMPLE,
      steps: [
        {
          id: 'valuate',
          kind: 'DO',
          policy: 'REQUIRED',
          action: { name: 'inventory.valuation.posted', version: 1 },
          compensation: { name: 'inventory.valuation.reversed', version: 1 },
          if: 'company.settings.finance.grnAccrual ===',
        },
      ],
    } as SagaDefinitionDocument;

    await expect(useCase.execute({ document })).rejects.toThrow(/cannot execute/);
    expect(definitions.create).not.toHaveBeenCalled();
  });

  it('honours an explicit status and author', async () => {
    const { useCase, definitions } = makeSut();

    await useCase.execute({
      document: GOODS_RECEIPT_SAGA_EXAMPLE,
      status: SagaDefinitionStatus.DRAFT,
      createdBy: 'user-1',
    });

    expect(definitions.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: SagaDefinitionStatus.DRAFT, createdBy: 'user-1' }),
    );
  });
});
