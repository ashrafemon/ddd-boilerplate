import { CreateProductInput } from '../../ports/inbound/product.command.port';

export class CreateProductCommand implements CreateProductInput {
  constructor(
    public readonly sku: string,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly unitPrice: number,
    public readonly currency: string | undefined,
  ) {}
}

export class UpdateProductCommand {
  constructor(
    public readonly id: string,
    public readonly name: string | undefined,
    public readonly description: string | undefined,
  ) {}
}

export class ChangePriceCommand {
  constructor(
    public readonly id: string,
    public readonly unitPrice: number,
    public readonly currency: string | undefined,
  ) {}
}

export class ActivateProductCommand {
  constructor(public readonly id: string) {}
}

export class DeactivateProductCommand {
  constructor(public readonly id: string) {}
}

export class DiscontinueProductCommand {
  constructor(public readonly id: string) {}
}
