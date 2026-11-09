import { Module } from '@nestjs/common';
import { ProductModule } from './product/product.module';
import { PricingModule } from './product-pricing/pricing.module';

@Module({
  imports: [ProductModule, PricingModule],
  controllers: [],
  providers: [],
  exports: [ProductModule, PricingModule],
})
export class ProductManagementModule {}
