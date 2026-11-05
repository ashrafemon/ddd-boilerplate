import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ChangePriceRequest } from '../../domain/types/product.types';
import { ProductPricingService } from '../../domain/services/product-pricing.service';
import { ProductCommandRepository } from '../../domain/repositories/product-command.repository';
import { ProductPublisherPort } from '../integrations/publishes/product.publisher-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class ChangePriceUseCase {
  constructor(
    private readonly productRepository: ProductCommandRepository,
    private readonly integrationEvent: ProductPublisherPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: ChangePriceRequest): Promise<string> {
    const company = await this.companyConfig.getCompanyConfig();

    const id = input.id;
    const product = await this.productRepository.findById(id.toString());
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.changePrice(
      ProductPricingService.toMoney(input.unitPrice, input.currency ?? company.defaultCurrency),
    );
    await this.productRepository.update(product);

    for (const event of product.pullEvents()) {
      await this.integrationEvent.send(event, product.id.toString());
    }

    return product.id.toString();
  }
}
