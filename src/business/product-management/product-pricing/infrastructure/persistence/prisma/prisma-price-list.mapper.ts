import { PriceList } from '@business/product-management/product-pricing/domain/aggregates/price-list.aggregate';
import { PriceListId } from '@business/product-management/product-pricing/domain/value-objects/price-list-id.vo';
import { PriceListCode } from '@business/product-management/product-pricing/domain/value-objects/price-list-code.vo';
import { PriceListQueryRecord } from '../../../domain/types/price-list.types';
import { PriceListStatus } from '../../../domain/types/price-list.enum';
import { PriceListProps } from '../../../domain/types/price-list.types';

export class PrismaPriceListMapper {
  static toDomain(row: {
    id: string;
    name: string;
    code: string;
    currency: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    status: string;
    tenantId: string | null;
    companyId: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): PriceList {
    return PriceList.instantiate(
      PriceListId.fromString(row.id),
      {
        id: PriceListId.fromString(row.id),
        name: row.name,
        code: PriceListCode.create(row.code),
        currency: row.currency,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        status: row.status as PriceListStatus,
        tenantId: row.tenantId,
        companyId: row.companyId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      } satisfies PriceListProps,
      row.version,
    );
  }

  static toRow(priceList: PriceList) {
    return {
      id: priceList.id.toString(),
      name: priceList.name,
      code: priceList.code,
      currency: priceList.currency,
      effectiveFrom: priceList.effectiveFrom,
      effectiveTo: priceList.effectiveTo,
      status: priceList.status,
      tenantId: priceList.tenantId,
      companyId: priceList.companyId,
      version: priceList.getVersion(),
      createdAt: priceList.createdAt,
      updatedAt: priceList.updatedAt,
    };
  }

  static toRecord(row: never): PriceListQueryRecord {
    const r = row as {
      id: string;
      name: string;
      code: string;
      currency: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      status: string;
      tenantId: string | null;
      companyId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      currency: r.currency,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      status: r.status,
      tenantId: r.tenantId,
      companyId: r.companyId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
