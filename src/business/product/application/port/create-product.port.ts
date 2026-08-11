import { CreateProductInput, CreateProductOutput } from '../type/create-product.input';

export abstract class CreateProductPort {
  public abstract execute(input: CreateProductInput): Promise<CreateProductOutput>;
}
