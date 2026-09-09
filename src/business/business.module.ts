import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { PartyModule } from './party/party.module';
import { PlatformModule } from '@platform/platform.module';
import { ProcurementModule } from './procurement/procurement.module';

@Module({
  imports: [CatalogModule, PartyModule, ProcurementModule, PlatformModule, InfrastructureModule],
})
export class BusinessModule {}
