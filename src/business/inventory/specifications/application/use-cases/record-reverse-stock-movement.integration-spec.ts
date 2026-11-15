import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecordStockMovementUseCase } from '@business/inventory/application/use-cases/record-stock-movement.usecase';
import { ReverseStockMovementUseCase } from '@business/inventory/application/use-cases/reverse-stock-movement.usecase';
import { StockMovementFactory } from '@business/inventory/domain/factories/stock-movement.factory';
import { StockBalance } from '@business/inventory/domain/aggregates/stock-movement.aggregate';
import { StockMovementType } from '@business/inventory/domain/types/stock-movement.enum';
import {
  InMemoryStockMovementRepository,
  InMemoryStockBalanceRepository,
  InMemoryInventoryPublisherPort,
  InMemoryInventoryAuditPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeInventoryContext,
} from '@test/support/inventory/inventory.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const receiptInput = {
  grnLineId: 'grn-line-1',
  productId: 'p1',
  quantity: 5,
  movementType: 'GOODS_RECEIPT',
  sourceDocumentId: 'grn-1',
  sourceDocumentType: 'GRN',
};

describe('RecordStockMovementUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
    const movements = new InMemoryStockMovementRepository();
    const balances = new InMemoryStockBalanceRepository();
    const publisher = new InMemoryInventoryPublisherPort();
    const audit = new InMemoryInventoryAuditPort();
    const ctx = makeInventoryContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new RecordStockMovementUseCase(
      movements,
      balances,
      publisher,
      ctx,
      abac,
      audit,
    );
    return { useCase, movements, balances, publisher, audit };
  }

  it('records a receipt and creates a new balance', async () => {
    const { useCase, movements, balances, publisher } = makeSut();
    const id = await useCase.execute(receiptInput);

    expect(id).toBeTruthy();
    expect(movements.saved).toHaveLength(1);
    expect(balances.saved).toHaveLength(1);
    expect(balances.saved[0].quantity).toBe(5);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('increments an existing balance on a second receipt', async () => {
    const { useCase, balances } = makeSut();
    await useCase.execute(receiptInput);
    await useCase.execute({ ...receiptInput, grnLineId: 'grn-line-2' });

    expect(balances.saved[balances.saved.length - 1].quantity).toBe(10);
  });

  it('decrements the balance for a reversal movement', async () => {
    const { useCase, balances } = makeSut();
    await useCase.execute(receiptInput);
    await useCase.execute({
      ...receiptInput,
      movementType: 'GOODS_RECEIPT_REVERSAL',
      sourceDocumentId: 'grn-1',
    });

    expect(balances.saved[balances.saved.length - 1].quantity).toBe(0);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(receiptInput)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute(receiptInput)).rejects.toThrow(ForbiddenException);
  });
});

describe('ReverseStockMovementUseCase (integration)', () => {
  function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
    const movements = new InMemoryStockMovementRepository();
    const original = StockMovementFactory.record({ ...receiptInput });
    movements.store.set(original.id.toString(), original);

    const balances = new InMemoryStockBalanceRepository();
    // the original receipt already left stock on the balance
    balances.byProduct.set(
      original.productId,
      StockBalance.instantiate(
        {
          id: 'balance-1',
          productId: original.productId,
          companyId: original.companyId,
          tenantId: original.tenantId,
          quantity: original.quantity,
          updatedAt: new Date(),
        },
        1,
      ),
    );

    const publisher = new InMemoryInventoryPublisherPort();
    const audit = new InMemoryInventoryAuditPort();
    const ctx = makeInventoryContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new ReverseStockMovementUseCase(
      movements,
      balances,
      publisher,
      ctx,
      abac,
      audit,
    );
    return { useCase, movements, balances, publisher, audit, original };
  }

  it('creates a compensating reversal movement', async () => {
    const { useCase, movements, original } = makeSut();
    const reversalId = await useCase.execute({ movementId: original.id.toString() });

    expect(reversalId).toBeTruthy();
    expect(movements.saved).toHaveLength(1);
    expect(movements.saved[0].movementType).toBe(StockMovementType.GOODS_RECEIPT_REVERSAL);
    expect(movements.saved[0].quantity).toBe(original.quantity);
  });

  it('applies a negative adjustment to the balance', async () => {
    const { useCase, balances, original } = makeSut();
    await useCase.execute({ movementId: original.id.toString() });
    // 5 on hand, less the 5 being reversed
    expect(balances.saved[balances.saved.length - 1].quantity).toBe(0);
  });

  it('records an audit entry', async () => {
    const { useCase, audit, original } = makeSut();
    await useCase.execute({ movementId: original.id.toString() });
    expect(audit.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the movement does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ movementId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, original } = makeSut({ noCompany: true });
    await expect(useCase.execute({ movementId: original.id.toString() })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, original } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ movementId: original.id.toString() })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
