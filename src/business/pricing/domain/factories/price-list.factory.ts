import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { PriceList } from '../aggregates/price-list.aggregate';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { PriceListCode } from '../value-objects/price-list-code.vo';
import { PriceListProps, CreatePriceListInput } from '../types/price-list.types';
import { PriceListCreated } from '../events/index';
import { PriceListStatus } from '../types/price-list.enum';
import '../aggregates/price-list.invariants';
import '../entities/price-list-line.entity.invariants';

export class PriceListFactory {
  static create(input: CreatePriceListInput): PriceList {
    invariantRegistry.enforce('price-list.create', {
      name: input.name,
      code: input.code,
      currency: input.currency,
    });

    const now = new Date();
    const priceList = PriceList.instantiate(
      PriceListId.generate(),
      {
        id: PriceListId.generate(),
        name: input.name.trim(),
        code: PriceListCode.create(input.code),
        currency: input.currency,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        status: PriceListStatus.DRAFT,
        tenantId: null,
        companyId: '',
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      1,
    );

    priceList.addEvent(
      new PriceListCreated(priceList.id, priceList.name, priceList.code, priceList.currency),
    );
    return priceList;
  }

  static reconstitute(id: PriceListId, props: PriceListProps, version: number): PriceList {
    return PriceList.instantiate(id, props, version);
  }
}
