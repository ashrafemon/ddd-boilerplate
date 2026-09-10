import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { PartyModule } from './party/party.module';
import { ProcurementModule } from './procurement/procurement.module';

/**
 * Business root. Only composes the bounded contexts; each aggregate module
 * imports `PlatformModule` itself for the platform services it uses. Nothing
 * here (or below) may import `@infrastructure`.
 */
@Module({
  imports: [CatalogModule, PartyModule, ProcurementModule],
})
export class BusinessModule {}
