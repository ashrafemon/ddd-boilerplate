import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CreateProductInput } from '../../ports/inbound/product.command.port';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/outbound/product-repository.port';
import { Product } from '../../domain/entities/product.aggregate';
import { Money } from '@business/shared-business/domain/money.value-object';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductErrors } from '../../domain/errors/product.errors';
import { Sku } from '../../domain/value-objects/sku.vo';

@Injectable()
export class CreateProductUseCase implements UseCase<CreateProductInput, ProductId> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: CreateProductInput): Promise<ProductId> {
    return this.unitOfWork.execute(async () => {
      const product = Product.create({
        sku: input.sku,
        name: input.name,
        description: input.description,
        unitPrice: Money.fromDecimal(input.unitPrice, input.currency ?? 'USD'),
        currency: input.currency ?? 'USD',
      });

      const existing = await this.productRepository.findBySku(Sku.create(product.sku));
      if (existing) {
        throw ProductErrors.skuConflict(product.sku);
      }

      await this.productRepository.save(product);

      for (const event of product.pullEvents()) {
        await this.outboxWriter.append(event, 'Product', product.id.toString());
        this.eventBus.publish(event);
      }

      return product.id;
    });
  }
}
