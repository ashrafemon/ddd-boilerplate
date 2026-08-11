import { GetProductInput, ProductOutput } from '../type/product.output';

export abstract class GetProductPort {
  public abstract execute(input: GetProductInput): Promise<ProductOutput>;
}
