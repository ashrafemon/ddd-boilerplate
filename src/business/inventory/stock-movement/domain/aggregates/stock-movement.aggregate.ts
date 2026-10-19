import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { StockMovementId } from '../value-objects/stock-movement-id.vo';
import { StockMovementProps, MovementType } from '../types/stock-movement.types';

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

  static create(props: Omit<StockMovementProps, 'id' | 'createdAt'>): StockMovement {
    const id = StockMovementId.generate();
    return new StockMovement(
      id,
      {
        ...props,
        id: id.toString(),
        createdAt: new Date(),
      },
      1,
    );
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
  get movementType(): MovementType {
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
  get tenantId(): string {
    return this.props.tenantId;
  }
  get actorId(): string | undefined {
    return this.props.actorId;
  }
  get effectiveDate(): Date {
    return this.props.effectiveDate;
  }
  get reversalOfId(): string | undefined {
    return this.props.reversalOfId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  getVersion(): number {
    return this.version;
  }
}
