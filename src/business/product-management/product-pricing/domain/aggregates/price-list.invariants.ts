import { PriceListStatus } from '../types/price-list.enum';

export class PriceListInvariants {
  static enforcePriceListCreate(name: string, code: string, currency: string): void {
    if (!name || name.trim().length === 0) {
      throw Object.assign(new Error('Price list name is required'), { statusCode: 422 });
    }
    if (!code || code.trim().length === 0) {
      throw Object.assign(new Error('Price list code is required'), { statusCode: 422 });
    }
    if (!currency || currency.trim().length === 0) {
      throw Object.assign(new Error('Price list currency is required'), { statusCode: 422 });
    }
  }

  static enforcePriceListStatusTransition(status: PriceListStatus, to: PriceListStatus): void {
    if (status === to) return;

    const allowed: Record<PriceListStatus, PriceListStatus[]> = {
      [PriceListStatus.DRAFT]: [PriceListStatus.ACTIVE, PriceListStatus.ARCHIVED],
      [PriceListStatus.ACTIVE]: [PriceListStatus.ARCHIVED],
      [PriceListStatus.ARCHIVED]: [],
    };

    if (!allowed[status].includes(to)) {
      throw Object.assign(new Error(`Invalid price list status transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  }

  static enforcePriceListLinePrice(price: number): void {
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error('Price list line price cannot be negative'), {
        statusCode: 422,
      });
    }
  }

  static enforcePriceListLineQuantityRange(minQuantity: number, maxQuantity: number | null): void {
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
  }
}
