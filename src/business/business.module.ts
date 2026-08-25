import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { PartyModule } from './party/party.module';
import { ProcurementModule } from './procurement/procurement.module';

@Module({
  imports: [CatalogModule, PartyModule, ProcurementModule],
})
export class BusinessModule {}
