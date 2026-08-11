import { Module } from '@nestjs/common';
import { ActivateVendorUseCase } from './application/use-case/activate-vendor/activate-vendor.use-case';
import { CreateVendorUseCase } from './application/use-case/create-vendor/create-vendor.use-case';
import { DeactivateVendorUseCase } from './application/use-case/deactivate-vendor/deactivate-vendor.use-case';
import { GetVendorUseCase } from './application/use-case/get-vendor/get-vendor.use-case';
import { UpdateVendorUseCase } from './application/use-case/update-vendor/update-vendor.use-case';
import { ValidateVendorUseCase } from './application/use-case/validate-vendor/validate-vendor.use-case';
import { ActivateVendorPort, DeactivateVendorPort } from './application/port/activate-vendor.port';
import { CreateVendorPort } from './application/port/create-vendor.port';
import { GetVendorPort } from './application/port/get-vendor.port';
import { UpdateVendorPort } from './application/port/update-vendor.port';
import { ValidateVendorPort } from './application/port/validate-vendor.port';
import { VendorWriteRepositoryPort } from './domain/port/vendor-write-repository.port';
import { VendorReadRepositoryPort } from './domain/port/vendor-read-repository.port';
import { VendorBuilder } from './domain/service/vendor-builder.service';
import { PrismaVendorReadRepositoryAdapter } from './infrastructure/persistence/read/vendor-read-repository.adapter';
import { PrismaVendorWriteRepositoryAdapter } from './infrastructure/persistence/write/vendor-write-repository.adapter';
import { VendorController } from './presentation/http/controller/vendor.controller';

/**
 * Vendor bounded context. Exposes its capabilities to other modules through
 * application ports only.
 */
@Module({
  controllers: [VendorController],
  providers: [
    VendorBuilder,
    CreateVendorUseCase,
    GetVendorUseCase,
    UpdateVendorUseCase,
    ActivateVendorUseCase,
    DeactivateVendorUseCase,
    ValidateVendorUseCase,
    { provide: CreateVendorPort, useExisting: CreateVendorUseCase },
    { provide: GetVendorPort, useExisting: GetVendorUseCase },
    { provide: UpdateVendorPort, useExisting: UpdateVendorUseCase },
    { provide: ActivateVendorPort, useExisting: ActivateVendorUseCase },
    { provide: DeactivateVendorPort, useExisting: DeactivateVendorUseCase },
    { provide: ValidateVendorPort, useExisting: ValidateVendorUseCase },
    { provide: VendorWriteRepositoryPort, useClass: PrismaVendorWriteRepositoryAdapter },
    { provide: VendorReadRepositoryPort, useClass: PrismaVendorReadRepositoryAdapter },
  ],
  exports: [
    CreateVendorPort,
    GetVendorPort,
    UpdateVendorPort,
    ActivateVendorPort,
    DeactivateVendorPort,
    ValidateVendorPort,
  ],
})
export class VendorModule {}
