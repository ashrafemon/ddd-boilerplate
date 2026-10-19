import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateGrnUseCase } from './create-grn.usecase';
import { GoodReceiptNote } from '../../domain/aggregates/grn.aggregate';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

class FakeGrnRepository extends GrnCommandRepository {
  readonly store = new Map<string, GoodReceiptNote>();
  saves = 0;

  save(grn: GoodReceiptNote) {
    this.saves++;
    this.store.set(grn.id.toString(), grn);
    return Promise.resolve(grn);
  }
  update(grn: GoodReceiptNote) {
    this.store.set(grn.id.toString(), grn);
    return Promise.resolve(grn);
  }
  findById(id: string) {
    return Promise.resolve(this.store.get(id) ?? null);
  }
  findByGrnNumber() {
    return Promise.resolve(null);
  }
  findByReversalOfId() {
    return Promise.resolve(null);
  }
}

describe('CreateGrnUseCase', () => {
  let repo: FakeGrnRepository;
  let numbering: { nextNumber: jest.Mock };
  let idempotency: { reserve: jest.Mock; complete: jest.Mock; fail: jest.Mock };
  let poStatus: string;
  let poVendor: string;
  let useCase: CreateGrnUseCase;

  const po: PurchaseOrderReference = {
    id: '00000000-0000-0000-0000-000000000001',
    orderNumber: 'PO-00000001',
    vendorId: '00000000-0000-0000-0000-0000000000aa',
    status: 'ISSUED',
    currency: 'USD',
    subtotal: 100,
    total: 100,
    lines: [{ productId: 'p1', quantity: 10, unitPrice: 10, total: 100 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const purchaseOrderPort = {
    getPurchaseOrder: () => Promise.resolve({ ...po, status: poStatus, vendorId: poVendor }),
    registerReceipt: jest.fn(),
    hasReceipts: jest.fn(),
  } as unknown as PurchaseOrderPort;

  const context = {
    getTenantId: () => 'tenant-1',
    getCompanyId: () => 'company-1',
    getUserId: () => 'receiver-1',
  } as unknown as RequestContextPort;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new FakeGrnRepository();
    poStatus = 'ISSUED';
    poVendor = po.vendorId;
    numbering = { nextNumber: jest.fn().mockResolvedValue('GRN-00000042') };
    idempotency = {
      reserve: jest.fn().mockResolvedValue({
        status: 'ACQUIRED',
        reservation: { id: 'r1', claimToken: 't', version: 1 },
      }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new CreateGrnUseCase(
      repo,
      purchaseOrderPort,
      { send: jest.fn().mockResolvedValue(undefined) },
      {
        getCompanyConfig: () =>
          Promise.resolve({
            companyName: 'Co',
            defaultCurrency: 'EUR',
            autoApproveThreshold: 10_000,
            overReceiptTolerance: 0.1,
            isActive: true,
          }),
      } as CompanyConfigPort,
      numbering,
      context,
    );
  });

  const input = (overrides = {}) => ({
    purchaseOrderId: po.id,
    lines: [{ productId: 'p1', receivedQuantity: 4, unitPrice: 999, orderedQuantity: 999 }],
    ...overrides,
  });

  it('snapshots orderedQuantity/unitPrice from the PO line (client values ignored) and stamps the actor', async () => {
    const id = await useCase.execute(input());

    const grn = repo.store.get(id.toString())!;
    expect(grn.grnNumber).toBe('GRN-00000042');
    expect(grn.vendorId).toBe(po.vendorId);
    expect(grn.currency).toBe('EUR'); // company default
    expect(grn.createdBy).toBe('receiver-1');
    expect(grn.lines[0]).toMatchObject({
      productId: 'p1',
      orderedQuantity: 10, // from the PO line, not the client's 999
      receivedQuantity: 4,
      unitPrice: 10, // from the PO line, not the client's 999
    });
    expect(numbering.nextNumber).toHaveBeenCalledWith('grn.number', {
      prefix: 'GRN-',
      padding: 8,
    });
  });

  it('refuses a PO that is not receiving-eligible (B5)', async () => {
    poStatus = 'DRAFT';
    await expect(useCase.execute(input())).rejects.toBeInstanceOf(ConflictException);
    expect(repo.saves).toBe(0);
  });

  it('refuses a vendor that differs from the PO vendor (B5)', async () => {
    await expect(
      useCase.execute(input({ vendorId: '00000000-0000-0000-0000-000000000099' })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.saves).toBe(0);
  });

  it('refuses a line whose product is not on the PO (B5)', async () => {
    await expect(
      useCase.execute(input({ lines: [{ productId: 'ghost', receivedQuantity: 1 }] })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.saves).toBe(0);
  });

  it('404s when the PO does not exist', async () => {
    purchaseOrderPort.getPurchaseOrder = () => Promise.resolve(null);
    await expect(useCase.execute(input())).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('idempotency (plan §1.4, scope grn.create)', () => {
    it('reserves with the client key, runs once, and completes with the new id', async () => {
      const id = await useCase.execute(input({ idempotencyKey: 'client-key-1' }));

      expect(idempotency.reserve).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        scope: 'grn.create',
        key: 'client-key-1',
      });
      expect(idempotency.complete).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        reservation: expect.anything(),
        result: id.toString(),
      });
      expect(idempotency.fail).not.toHaveBeenCalled();
    });

    it('REPLAY returns the original id without creating anything', async () => {
      idempotency.reserve.mockResolvedValue({ status: 'REPLAY', result: 'grn-existing' });

      const id = await useCase.execute(input({ idempotencyKey: 'client-key-1' }));

      expect(id.toString()).toBe('grn-existing');
      expect(repo.saves).toBe(0);
      expect(numbering.nextNumber).not.toHaveBeenCalled();
    });

    it('BUSY surfaces as 409', async () => {
      idempotency.reserve.mockResolvedValue({ status: 'BUSY' });
      await expect(useCase.execute(input({ idempotencyKey: 'k' }))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('failure releases the claim via fail()', async () => {
      poStatus = 'CANCELLED';
      await expect(useCase.execute(input({ idempotencyKey: 'k' }))).rejects.toThrow();
      expect(idempotency.fail).toHaveBeenCalledTimes(1);
      expect(idempotency.complete).not.toHaveBeenCalled();
    });

    it('without a key the command still runs (backward compatible, no reserve)', async () => {
      await useCase.execute(input());
      expect(idempotency.reserve).not.toHaveBeenCalled();
      expect(repo.saves).toBe(1);
    });
  });

  it('uses a generated id VO internally and persists once', async () => {
    const id = await useCase.execute(input());
    expect(id).toBeInstanceOf(GrnId);
    expect(repo.saves).toBe(1);
  });
});
