import type { TrackingEntry } from '../types/grn.types';

export class GrnLine {
  private constructor(
    public readonly productId: string,
    public readonly orderedQuantity: number,
    public readonly receivedQuantity: number,
    public readonly acceptedQuantity: number,
    public readonly rejectedQuantity: number,
    public readonly unitPrice: number,
    public readonly tracking: TrackingEntry[] = [],
  ) {}

  static create(
    productId: string,
    orderedQuantity: number,
    receivedQuantity: number,
    unitPrice: number,
    acceptedQuantity?: number,
    rejectedQuantity?: number,
    tracking?: TrackingEntry[],
  ): GrnLine {
    const accepted = acceptedQuantity ?? receivedQuantity;
    const rejected = rejectedQuantity ?? 0;
    return new GrnLine(
      productId,
      orderedQuantity,
      receivedQuantity,
      accepted,
      rejected,
      unitPrice,
      tracking ?? [],
    );
  }

  get total(): number {
    return this.receivedQuantity * this.unitPrice;
  }

  get acceptedTotal(): number {
    return this.acceptedQuantity * this.unitPrice;
  }

  get valuationAmount(): number {
    return this.acceptedQuantity * this.unitPrice;
  }

  withReceivedQuantity(receivedQuantity: number): GrnLine {
    return new GrnLine(
      this.productId,
      this.orderedQuantity,
      receivedQuantity,
      this.acceptedQuantity,
      this.rejectedQuantity,
      this.unitPrice,
      this.tracking,
    );
  }

  withTracking(tracking: TrackingEntry[]): GrnLine {
    return new GrnLine(
      this.productId,
      this.orderedQuantity,
      this.receivedQuantity,
      this.acceptedQuantity,
      this.rejectedQuantity,
      this.unitPrice,
      tracking,
    );
  }

  withInspection(acceptedQuantity: number, rejectedQuantity: number): GrnLine {
    return new GrnLine(
      this.productId,
      this.orderedQuantity,
      this.receivedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      this.unitPrice,
      this.tracking,
    );
  }
}
