export interface PriceListReference {
  id: string;
  name: string;
  code: string;
  currency: string;
  status: string;
}

export interface PriceListLineReference {
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  maxQuantity: number | null;
}
