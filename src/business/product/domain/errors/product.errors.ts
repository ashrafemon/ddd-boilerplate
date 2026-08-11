import { ConflictError, NotFoundError } from '@business/shared-business/domain/domain.error';

export const ProductErrors = {
  notFound: () => new NotFoundError('Product not found'),
  skuConflict: (sku: string) => new ConflictError(`Product with SKU "${sku}" already exists`),
} as const;
