import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
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

export type ProductStatusAction = 'activate' | 'deactivate' | 'discontinue';

export interface ProductStatusInput {
  id: string;
  action: ProductStatusAction;
}

@Injectable()
export class ProductStatusUseCase implements CommandUseCase<ProductStatusInput, ProductId> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepository: ProductCommandRepositoryPort,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: ProductStatusInput): Promise<ProductId> {
    await this.companyConfig.getCompanyConfig();

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
    }

    return product.id;
  }
}
