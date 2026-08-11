import {
  ConflictError,
  InvalidStateTransitionError,
  NotFoundError,
} from '@business/shared-business/domain/domain.error';

export const PurchaseOrderErrors = {
  notFound: () => new NotFoundError('Purchase order not found'),
  orderNumberConflict: (orderNumber: string) =>
    new ConflictError(`Purchase order ${orderNumber} already exists`),
  invalidTransition: (from: string, to: string) =>
    new InvalidStateTransitionError(`Invalid purchase order transition: ${from} -> ${to}`),
  vendorNotFound: () => new NotFoundError('Vendor not found'),
  productNotFound: () => new NotFoundError('Product not found'),
  vendorNotOrderable: () =>
    new InvalidStateTransitionError('Vendor is not orderable (blocked or inactive)'),
  productNotPurchasable: () =>
    new InvalidStateTransitionError('Product is not purchasable (inactive or discontinued)'),
} as const;
