import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderLine } from '@business/procurement/purchase-order/domain/entities/purchase-order-line.entity';
import { PurchaseOrderId } from '@business/procurement/purchase-order/domain/value-objects/purchase-order-id.vo';
import { OrderNumber } from '@business/procurement/purchase-order/domain/value-objects/order-number.vo';
import { ProductIdRef } from '@business/procurement/purchase-order/domain/value-objects/product-id-ref.vo';
import { VendorIdRef } from '@business/procurement/purchase-order/domain/value-objects/vendor-id-ref.vo';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import { UpdatePurchaseOrderLineUseCase } from '@business/procurement/purchase-order/application/use-cases/update-purchase-order-line.usecase';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryProductQueryPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
  makeProductRef,
  makePurchaseOrderWithLines,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const PRODUCT_ID = 'product-1';

function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean; productMissing?: boolean }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = makePurchaseOrderWithLines([
    { productId: PRODUCT_ID, quantity: 5, unitPriceMinor: 1000 },
  ]);
  repo.store.set(po.id.toString(), po);

  const products = new Map<string, ReturnType<typeof makeProductRef>>();
  if (!opts?.productMissing) products.set(PRODUCT_ID, makeProductRef());

  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new UpdatePurchaseOrderLineUseCase(
    repo,
    new InMemoryProductQueryPort(products),
    publisher,
    ctx,
    abac,
  );
  return { useCase, repo, publisher, po };
}

describe('UpdatePurchaseOrderLineUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('replaces quantity and price on an existing line', async () => {
    const { useCase, repo, publisher, po } = makeSut();
    const id = await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 8,
      unitPrice: 12.5,
    });

    expect(id).toBe(po.id.toString());
    const line = repo.updates[0].lines.find(l => l.productId.toString() === PRODUCT_ID);
    expect(line?.quantity).toBe(8);
    expect(line?.unitPrice.minorUnits).toBe(1250);
    expect(line?.total.minorUnits).toBe(1250 * 8);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps an existing snapshot immutable when the line is updated', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const now = new Date();
    const po = PurchaseOrder.instantiate(
      PurchaseOrderId.generate(),
      {
        orderNumber: OrderNumber.create('PO-00000001'),
        vendorId: new VendorIdRef('11111111-1111-1111-1111-111111111111'),
        status: PurchaseOrderStatus.DRAFT,
        currency: 'USD',
        // the line already carries a commercial snapshot from add time
        lines: [
          new PurchaseOrderLine(
            new ProductIdRef(PRODUCT_ID),
            5,
            Money.fromMinorUnits(1000, 'USD'),
            Money.fromMinorUnits(5000, 'USD'),
            0,
            'Original Name',
          ),
        ],
        createdAt: now,
        updatedAt: now,
      },
      1,
    );
    repo.store.set(po.id.toString(), po);

    const useCase = new UpdatePurchaseOrderLineUseCase(
      repo,
      new InMemoryProductQueryPort(new Map([[PRODUCT_ID, makeProductRef()]])),
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      new AllowAbacAdapter(),
    );

    await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 2,
      unitPrice: 10,
    });
    const line = repo.updates[0].lines.find(l => l.productId.toString() === PRODUCT_ID);
    // a product rename never rewrites an existing PO line
    expect(line?.descriptionSnapshot).toBe('Original Name');
  });

  it('snapshots the product name when adding a brand-new line', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = makePurchaseOrderWithLines([
      { productId: 'other', quantity: 1, unitPriceMinor: 100 },
    ]);
    repo.store.set(po.id.toString(), po);

    const useCase = new UpdatePurchaseOrderLineUseCase(
      repo,
      new InMemoryProductQueryPort(new Map([[PRODUCT_ID, makeProductRef()]])),
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      new AllowAbacAdapter(),
    );

    await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 2,
      unitPrice: 10,
    });
    const line = repo.updates[0].lines.find(l => l.productId.toString() === PRODUCT_ID);
    expect(line?.descriptionSnapshot).toBe('Wireless Mouse');
  });

  it('adds the line when the product is not on the order yet', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = makePurchaseOrderWithLines([
      { productId: 'other', quantity: 1, unitPriceMinor: 100 },
    ]);
    repo.store.set(po.id.toString(), po);

    const useCase = new UpdatePurchaseOrderLineUseCase(
      repo,
      new InMemoryProductQueryPort(new Map([[PRODUCT_ID, makeProductRef()]])),
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      new AllowAbacAdapter(),
    );

    await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 3,
      unitPrice: 10,
    });
    expect(repo.updates[0].lines).toHaveLength(2);
  });

  it('throws ConflictException when the product is not purchasable', async () => {
    const { useCase, po } = makeSut({ productMissing: true });
    await expect(
      useCase.execute({ id: po.id.toString(), productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(
      useCase.execute({ id: 'missing', productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(
      useCase.execute({ id: po.id.toString(), productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, po } = makeSut({ abacDeny: true });
    await expect(
      useCase.execute({ id: po.id.toString(), productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(ForbiddenException);
  });
});
