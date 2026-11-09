export class PriceListLine {
  private constructor(
    public readonly id: string,
    public readonly priceListId: string,
    public readonly productId: string,
    public price: number,
    public minQuantity: number,
    public maxQuantity: number | null,
  ) {}

  static create(input: {
    priceListId: string;
    productId: string;
    price: number;
    minQuantity: number;
    maxQuantity?: number | null;
  }): PriceListLine {
    return new PriceListLine(
      crypto.randomUUID(),
      input.priceListId,
      input.productId,
      input.price,
      input.minQuantity,
      input.maxQuantity ?? null,
    );
  }

  updatePrice(newPrice: number): void {
    this.price = newPrice;
  }

  updateQuantities(minQuantity: number, maxQuantity: number | null): void {
    this.minQuantity = minQuantity;
    this.maxQuantity = maxQuantity;
  }
}
