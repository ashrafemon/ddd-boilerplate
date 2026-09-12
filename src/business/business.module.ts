import { Module } from '@nestjs/common';
import { PartyModule } from './party/party.module';
import { ProcurementModule } from './procurement/procurement.module';
import { SalesModule } from './sales/sales.module';

/**
 * Business root. Only composes the bounded contexts; each aggregate module
 * imports `PlatformModule` itself for the platform services it uses. Nothing
 * here (or below) may import `@infrastructure`.
 */
@Module({
  imports: [PartyModule, ProcurementModule, SalesModule],
})
export class BusinessModule {}
