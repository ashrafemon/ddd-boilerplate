import { Module } from '@nestjs/common';
import { VendorController } from './controllers/vendor.controller';
import { CreateVendorUseCase } from './application/use-cases/create-vendor.use-case';
import { UpdateVendorUseCase } from './application/use-cases/update-vendor.use-case';
import { VendorStatusUseCase } from './application/use-cases/vendor-status.use-case';
import { VendorQueryService } from './application/queries/vendor-query.service';
import { VendorCommandService } from './application/vendor-command.service';
import { VENDOR_COMMAND_PORT } from './ports/inbound/vendor.command.port';
import { VENDOR_QUERY_PORT } from './ports/inbound/vendor.query.port';

@Module({
  controllers: [VendorController],
  providers: [
    CreateVendorUseCase,
    UpdateVendorUseCase,
    VendorStatusUseCase,
    VendorQueryService,
    VendorCommandService,
    { provide: VENDOR_COMMAND_PORT, useExisting: VendorCommandService },
    { provide: VENDOR_QUERY_PORT, useExisting: VendorQueryService },
  ],
  exports: [VendorCommandService, VendorQueryService, VENDOR_COMMAND_PORT, VENDOR_QUERY_PORT],
})
export class VendorModule {}
