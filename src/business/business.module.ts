import { Module } from '@nestjs/common';
import { PartyModule } from './party/party.module';
import { ProductManagementModule } from './product-management/product-management.module';
import { ProcurementModule } from './procurement/procurement.module';
import { InventoryModule } from './inventory/inventory.module';
import { FinanceModule } from './finance/finance.module';
import { SalesModule } from './sales/sales.module';

/**
 * Business root. Only composes the bounded contexts; each aggregate module
 * imports `PlatformModule` itself for the platform services it uses. Nothing
 * here (or below) may import `@infrastructure`.
 */
@Module({
  imports: [
    PartyModule,
    ProductManagementModule,
    ProcurementModule,
    InventoryModule,
    FinanceModule,
    SalesModule,
  ],
})
export class BusinessModule {}
