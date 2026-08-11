import { ConflictError, NotFoundError } from '@business/shared-business/domain/domain.error';

export const VendorErrors = {
  notFound: () => new NotFoundError('Vendor not found'),
  codeConflict: (code: string) => new ConflictError(`Vendor with code "${code}" already exists`),
} as const;
