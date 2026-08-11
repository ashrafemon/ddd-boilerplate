import {
  ActivateProductInput,
  ActivateProductOutput,
  DeactivateProductInput,
  DeactivateProductOutput,
  UpdateProductInput,
  UpdateProductOutput,
} from '../type/update-product.input';

export abstract class UpdateProductPort {
  public abstract execute(input: UpdateProductInput): Promise<UpdateProductOutput>;
}

export abstract class ActivateProductPort {
  public abstract execute(input: ActivateProductInput): Promise<ActivateProductOutput>;
}

export abstract class DeactivateProductPort {
  public abstract execute(input: DeactivateProductInput): Promise<DeactivateProductOutput>;
}
