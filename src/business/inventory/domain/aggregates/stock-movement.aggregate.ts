import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { StockMovementRecorded } from '../events/index';
import { StockMovementProps } from '../types/stock-movement.types';
import { StockMovementId } from '../value-objects/stock-movement-id.vo';
import { StockMovementType } from '../types/stock-movement.enum';
import './stock-movement.invariants';
import { StockBalanceProps } from '../types/stock-movement.types';

export class StockMovement extends AggregateRoot<StockMovementId> {
  private props: StockMovementProps;

  private constructor(id: StockMovementId, props: StockMovementProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static instantiate(
    id: StockMovementId,
    props: StockMovementProps,
    version: number,
  ): StockMovement {
    return new StockMovement(id, props, version);
  }

  get grnLineId(): string {
    return this.props.grnLineId;
  }

  get productId(): string {
    return this.props.productId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get movementType(): StockMovementType {
    return this.props.movementType;
  }

  get sourceDocumentId(): string {
    return this.props.sourceDocumentId;
  }

  get sourceDocumentType(): string {
    return this.props.sourceDocumentType;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get tenantId(): string | null {
    return this.props.tenantId;
  }

  get actorId(): string | null {
    return this.props.actorId;
  }

  get effectiveDate(): Date {
    return this.props.effectiveDate;
  }

  get reversalOfId(): string | null {
    return this.props.reversalOfId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static record(input: {
    grnLineId: string;
    productId: string;
    quantity: number;
    movementType: StockMovementType;
    sourceDocumentId: string;
    sourceDocumentType: string;
    companyId: string;
    tenantId: string | null;
    actorId: string | null;
    effectiveDate: Date;
    reversalOfId: string | null;
  }): StockMovement {
    invariantRegistry.enforce('stock-movement.quantity', { quantity: input.quantity });
    invariantRegistry.enforce('stock-movement.type', { movementType: input.movementType });

    const movement = StockMovement.instantiate(
      StockMovementId.generate(),
      {
        id: StockMovementId.generate(),
        grnLineId: input.grnLineId,
        productId: input.productId,
        quantity: input.quantity,
        movementType: input.movementType,
        sourceDocumentId: input.sourceDocumentId,
        sourceDocumentType: input.sourceDocumentType,
        companyId: input.companyId,
        tenantId: input.tenantId,
        actorId: input.actorId,
        effectiveDate: input.effectiveDate,
        reversalOfId: input.reversalOfId,
        createdAt: input.effectiveDate,
      },
      1,
    );

    movement.addEvent(
      new StockMovementRecorded(
        movement.id,
        movement.productId,
        movement.quantity,
        movement.movementType,
        movement.sourceDocumentId,
        movement.sourceDocumentType,
      ),
    );

    return movement;
  }
}

export class StockBalance {
  private props: StockBalanceProps;
  private version: number;

  private constructor(props: StockBalanceProps, version: number) {
    this.props = props;
    this.version = version;
  }

  static instantiate(props: StockBalanceProps, version: number): StockBalance {
    return new StockBalance(props, version);
  }

  get productId(): string {
    return this.props.productId;
  }

  get id(): string {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get tenantId(): string | null {
    return this.props.tenantId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  adjust(delta: number, now: Date = new Date()): StockBalance {
    this.props.quantity += delta;
    this.props.updatedAt = now;
    return this;
  }

  static reconstitute(props: StockBalanceProps, version: number): StockBalance {
    return new StockBalance(props, version);
  }

  getVersion(): number {
    return this.version;
  }
}

export { StockBalanceUpdated } from '../events/index';
export { StockMovementRecorded } from '../events/index';
export type { StockBalanceProps } from '../types/stock-movement.types';
