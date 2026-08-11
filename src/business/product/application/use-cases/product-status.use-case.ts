import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/ports/outbox-writer.port';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/outbound/product-repository.port';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductErrors } from '../../domain/errors/product.errors';

type StatusAction = 'activate' | 'deactivate' | 'discontinue';

@Injectable()
export class ProductStatusUseCase implements UseCase<
  { id: string; action: StatusAction },
  ProductId
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: { id: string; action: StatusAction }): Promise<ProductId> {
    return this.unitOfWork.execute(async () => {
      const id = ProductId.fromString(input.id);
      const product = await this.productRepository.findById(id);
      if (!product) {
        throw ProductErrors.notFound();
      }

      switch (input.action) {
        case 'activate':
          product.activate();
          break;
        case 'deactivate':
          product.deactivate();
          break;
        case 'discontinue':
          product.discontinue();
          break;
      }

      await this.productRepository.update(product);

      for (const event of product.pullEvents()) {
        await this.outboxWriter.append(event, 'Product', product.id.toString());
        this.eventBus.publish(event);
      }

      return product.id;
    });
  }
}
