import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { ProductErrors } from '../../domain/errors/product.errors';
import {
  PRODUCT_COMMAND_REPOSITORY,
  ProductCommandRepositoryPort,
} from '../../domain/ports/product-command-repository.port';

export interface UpdateProductInput {
  id: string;
  name?: string;
  description?: string;
}

@Injectable()
export class UpdateProductUseCase implements CommandUseCase<UpdateProductInput, ProductId> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepository: ProductCommandRepositoryPort,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: UpdateProductInput): Promise<ProductId> {
    await this.companyConfig.getCompanyConfig();

    const id = ProductId.fromString(input.id);
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw ProductErrors.notFound();
    }

    product.update({ name: input.name, description: input.description });
    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.outboxWriter.append(event, 'Product', product.id.toString());
      this.eventBus.publish(event);
    }

    return product.id;
  }
}
