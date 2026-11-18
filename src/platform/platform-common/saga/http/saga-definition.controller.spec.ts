import { SagaDefinitionStatus } from '../types/saga.types';
import { GOODS_RECEIPT_SAGA_EXAMPLE } from '../types/definitions/goods-receipt.example';
import { SagaDefinitionController } from './saga-definition.controller';

/**
 * Unit — the runtime definition API is the only entry point for a saga.
 *
 * Publishing passes the document through untouched (the use case parses and
 * validates it), DRAFT stays unroutable, and status changes are delegated rather
 * than reimplemented here.
 */
describe('SagaDefinitionController', () => {
  function makeSut() {
    const publish = { execute: jest.fn(async () => ({ registered: true })) };
    const list = { execute: jest.fn(async () => []) };
    const setStatus = { execute: jest.fn(async () => ({ id: 'def-1' })) };
    const validateActive = { execute: jest.fn(async () => ({ checked: 1, invalidated: 0 })) };
    const controller = new SagaDefinitionController(
      publish as never,
      list as never,
      setStatus as never,
      validateActive as never,
    );
    return { controller, publish, list, setStatus, validateActive };
  }

  it('publishes an ACTIVE definition by default', async () => {
    const { controller, publish } = makeSut();

    const response = await controller.publishDefinition({
      document: GOODS_RECEIPT_SAGA_EXAMPLE,
      ownerModule: 'procurement',
    });

    expect(publish.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerModule: 'procurement',
        status: SagaDefinitionStatus.ACTIVE,
        document: GOODS_RECEIPT_SAGA_EXAMPLE,
      }),
    );
    expect(response.message).toBe('Saga definition published');
  });

  it('keeps a DRAFT unroutable', async () => {
    const { controller, publish } = makeSut();

    await controller.publishDefinition({
      document: GOODS_RECEIPT_SAGA_EXAMPLE,
      status: 'DRAFT',
    });

    expect(publish.execute).toHaveBeenCalledWith(
      expect.objectContaining({ status: SagaDefinitionStatus.DRAFT, ownerModule: null }),
    );
  });

  it('lists the catalogue with the requested filter', async () => {
    const { controller, list } = makeSut();

    await controller.listDefinitions({ status: 'INVALID', sagaKey: 'goods_receipt' });

    expect(list.execute).toHaveBeenCalledWith({
      status: SagaDefinitionStatus.INVALID,
      sagaKey: 'goods_receipt',
    });
  });

  it('delegates a status flip with the platform enum value', async () => {
    const { controller, setStatus } = makeSut();

    await controller.changeStatus('def-1', { status: 'RETIRED' });

    expect(setStatus.execute).toHaveBeenCalledWith({
      definitionId: 'def-1',
      status: SagaDefinitionStatus.RETIRED,
    });
  });

  it('exposes an on-demand revalidation sweep', async () => {
    const { controller, validateActive } = makeSut();

    const response = await controller.validateDefinitions();

    expect(validateActive.execute).toHaveBeenCalled();
    expect(response.data).toEqual({ checked: 1, invalidated: 0 });
  });
});
