import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { PriceListStatus } from '../types/price-list.enum';

invariantRegistry.register<{ name: string; code: string; currency: string }>('price-list.create', {
  name: 'price-list-create-required-fields',
  check: ({ name, code, currency }) => {
    if (!name || name.trim().length === 0) {
      throw Object.assign(new Error('Price list name is required'), { statusCode: 422 });
    }
    if (!code || code.trim().length === 0) {
      throw Object.assign(new Error('Price list code is required'), { statusCode: 422 });
    }
    if (!currency || currency.trim().length === 0) {
      throw Object.assign(new Error('Price list currency is required'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ status: PriceListStatus; to: PriceListStatus }>(
  'price-list.status-transition',
  {
    name: 'price-list-valid-status-transition',
    check: ({ status, to }) => {
      if (status === to) return;

      const allowed: Record<PriceListStatus, PriceListStatus[]> = {
        [PriceListStatus.DRAFT]: [PriceListStatus.ACTIVE, PriceListStatus.ARCHIVED],
        [PriceListStatus.ACTIVE]: [PriceListStatus.ARCHIVED],
        [PriceListStatus.ARCHIVED]: [], // reactivation requires an explicit policy
      };

      if (!allowed[status].includes(to)) {
        throw Object.assign(new Error(`Invalid price list status transition: ${status} -> ${to}`), {
          statusCode: 422,
        });
      }
    },
  },
);

invariantRegistry.register<{ price: number }>('price-list-line.price', {
  name: 'price-list-line-price-non-negative',
  check: ({ price }) => {
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error('Price list line price cannot be negative'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ minQuantity: number; maxQuantity: number | null }>(
  'price-list-line.quantity-range',
  {
    name: 'price-list-line-quantity-range-valid',
    check: ({ minQuantity, maxQuantity }) => {
      if (!Number.isFinite(minQuantity) || minQuantity < 1) {
        throw Object.assign(new Error('Price list line minimum quantity must be >= 1'), {
          statusCode: 422,
        });
      }
      if (maxQuantity !== null && maxQuantity < minQuantity) {
        throw Object.assign(
          new Error('Price list line maximum quantity must be >= minimum quantity'),
          { statusCode: 422 },
        );
      }
    },
  },
);
