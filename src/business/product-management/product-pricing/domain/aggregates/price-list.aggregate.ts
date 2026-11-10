import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { PriceListInvariants } from './price-list.invariants';
import { PriceListActivated } from '../events/price-list-activated.event';
import { PriceListDeactivated } from '../events/price-list-deactivated.event';
import { PriceListArchived } from '../events/price-list-archived.event';
import { PriceListUpdated } from '../events/price-list-updated.event';
import { PriceListLineAdded } from '../events/price-list-line-added.event';
import { PriceListLineUpdated } from '../events/price-list-line-updated.event';
import { PriceListLineRemoved } from '../events/price-list-line-removed.event';
import { PriceListProps } from '../types/price-list.types';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { PriceListCode } from '../value-objects/price-list-code.vo';
import { PriceListStatus } from '../types/price-list.enum';
import { PriceListLine } from '../entities/price-list-line.entity';
import { PriceListReactivationPolicy } from '../policies/reactivation.policy';

export class PriceList extends AggregateRoot<PriceListId> {
  private props: PriceListProps;
  private lineMap: Map<string, PriceListLine> = new Map();

  private constructor(id: PriceListId, props: PriceListProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static instantiate(id: PriceListId, props: PriceListProps, version: number): PriceList {
    return new PriceList(id, props, version);
  }

  get name(): string {
    return this.props.name;
  }

  get code(): string {
    return this.props.code.toString();
  }

  get currency(): string {
    return this.props.currency;
  }

  get effectiveFrom(): Date {
    return this.props.effectiveFrom;
  }

  get effectiveTo(): Date | null {
    return this.props.effectiveTo;
  }

  get status(): PriceListStatus {
    return this.props.status;
  }

  get tenantId(): string | null {
    return this.props.tenantId;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get lineItems(): readonly PriceListLine[] {
    return Array.from(this.lineMap.values());
  }

  addLine(input: {
    productId: string;
    price: number;
    minQuantity: number;
    maxQuantity?: number | null;
  }): void {
    PriceListInvariants.PriceListInvariants.enforcePriceListLinePrice(input.price);
    PriceListInvariants.PriceListInvariants.enforcePriceListLineQuantityRange(
      input.minQuantity,
      input.maxQuantity ?? null,
    );

    const existing = this.lineMap.get(input.productId);
    if (existing) {
      existing.updatePrice(input.price);
      existing.updateQuantities(input.minQuantity, input.maxQuantity ?? null);
      this.addEvent(new PriceListLineUpdated(this.id, input.productId));
      return;
    }

    const line = PriceListLine.create({
      priceListId: this.id.toString(),
      productId: input.productId,
      price: input.price,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity ?? null,
    });
    this.lineMap.set(input.productId, line);
    this.addEvent(new PriceListLineAdded(this.id, input.productId));
  }

  removeLine(productId: string): void {
    if (!this.lineMap.has(productId)) {
      throw Object.assign(new Error(`Product ${productId} not found in price list`), {
        statusCode: 404,
      });
    }
    this.lineMap.delete(productId);
    this.addEvent(new PriceListLineRemoved(this.id, productId));
  }

  updateLine(input: {
    productId: string;
    price?: number;
    minQuantity?: number;
    maxQuantity?: number | null;
  }): void {
    const line = this.lineMap.get(input.productId);
    if (!line) {
      throw Object.assign(new Error(`Product ${input.productId} not found in price list`), {
        statusCode: 404,
      });
    }

    if (input.price !== undefined) {
      PriceListInvariants.PriceListInvariants.enforcePriceListLinePrice(input.price);
      line.updatePrice(input.price);
    }
    if (input.minQuantity !== undefined || input.maxQuantity !== undefined) {
      PriceListInvariants.PriceListInvariants.enforcePriceListLineQuantityRange(
        input.minQuantity ?? line.minQuantity,
        input.maxQuantity ?? line.maxQuantity,
      );
      line.updateQuantities(
        input.minQuantity ?? line.minQuantity,
        input.maxQuantity ?? line.maxQuantity,
      );
    }

    this.addEvent(new PriceListLineUpdated(this.id, input.productId));
  }

  update(input: {
    name?: string;
    code?: string;
    currency?: string;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
  }): void {
    if (input.name !== undefined) {
      this.props.name = input.name.trim();
    }
    if (input.code !== undefined) {
      this.props.code = PriceListCode.create(input.code);
    }
    if (input.currency !== undefined) {
      this.props.currency = input.currency;
    }
    if (input.effectiveFrom !== undefined && input.effectiveFrom !== null) {
      this.props.effectiveFrom = input.effectiveFrom;
    }
    if (input.effectiveTo !== undefined) {
      this.props.effectiveTo = input.effectiveTo;
    }
    this.props.updatedAt = new Date();

    this.addEvent(
      new PriceListUpdated(
        this.id,
        input.name ?? null,
        input.code ?? null,
        input.currency ?? null,
        input.effectiveFrom ?? null,
        input.effectiveTo ?? null,
      ),
    );
  }

  activate(): void {
    if (!PriceListReactivationPolicy.enforcePriceListReactivation(this.props.status)) {
      throw Object.assign(new Error('Price list cannot be reactivated'), {
        statusCode: 422,
      });
    }
    PriceListInvariants.enforcePriceListStatusTransition(this.props.status, PriceListStatus.ACTIVE);

    this.props.status = PriceListStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new PriceListActivated(this.id));
  }

  deactivate(): void {
    PriceListInvariants.enforcePriceListStatusTransition(this.props.status, PriceListStatus.ACTIVE);

    this.props.status = PriceListStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new PriceListDeactivated(this.id));
  }

  archive(): void {
    PriceListInvariants.enforcePriceListStatusTransition(
      this.props.status,
      PriceListStatus.ARCHIVED,
    );

    this.props.status = PriceListStatus.ARCHIVED;
    this.props.updatedAt = new Date();
    this.addEvent(new PriceListArchived(this.id));
  }
}
