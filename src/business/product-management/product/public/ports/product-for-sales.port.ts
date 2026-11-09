import { ProductReference } from '../contracts/product-for-sales.contract';

export abstract class ProductForSalesPort {
  abstract getProductForSales(id: string): Promise<ProductReference | null>;
}
