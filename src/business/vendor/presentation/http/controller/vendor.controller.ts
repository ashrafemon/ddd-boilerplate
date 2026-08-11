import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { zodValidationPipe } from '../../../../../shared-kernel/pipes/zod-validation.pipe';
import { CreateVendorRequestSchema } from '../request/create-vendor.request';
import { UpdateVendorRequestSchema } from '../request/update-vendor.request';
import { Roles } from '../../../../../shared-kernel/http/decorator/roles.decorator';
import { CreateVendorInput } from '../../../application/type/create-vendor.input';
import { UpdateVendorInput } from '../../../application/type/update-vendor.input';
import { ActivateVendorUseCase } from '../../../application/use-case/activate-vendor/activate-vendor.use-case';
import { DeactivateVendorUseCase } from '../../../application/use-case/deactivate-vendor/deactivate-vendor.use-case';
import { CreateVendorUseCase } from '../../../application/use-case/create-vendor/create-vendor.use-case';
import { GetVendorUseCase } from '../../../application/use-case/get-vendor/get-vendor.use-case';
import { UpdateVendorUseCase } from '../../../application/use-case/update-vendor/update-vendor.use-case';
import { VendorResponse } from '../response/vendor.response';

/**
 * Thin HTTP controller: extracts request context, validates with Zod, invokes
 * application ports and returns response DTOs. Contains no business logic.
 */
@Controller('vendors')
export class VendorController {
  constructor(
    private readonly createVendorUseCase: CreateVendorUseCase,
    private readonly getVendorUseCase: GetVendorUseCase,
    private readonly updateVendorUseCase: UpdateVendorUseCase,
    private readonly activateVendorUseCase: ActivateVendorUseCase,
    private readonly deactivateVendorUseCase: DeactivateVendorUseCase,
  ) {}

  @Post()
  @Roles('purchase.admin', 'vendor.manager')
  public async create(
    @Body(zodValidationPipe(CreateVendorRequestSchema)) body: CreateVendorInput,
  ): Promise<{ vendorId: string }> {
    return this.createVendorUseCase.execute(body);
  }

  @Get(':vendorId')
  @Roles('purchase.admin', 'vendor.viewer')
  public async get(@Param('vendorId') vendorId: string): Promise<VendorResponse> {
    return this.getVendorUseCase.execute({ vendorId });
  }

  @Patch(':vendorId')
  @Roles('purchase.admin', 'vendor.manager')
  public async update(
    @Param('vendorId') vendorId: string,
    @Body(zodValidationPipe(UpdateVendorRequestSchema)) body: Omit<UpdateVendorInput, 'vendorId'>,
  ): Promise<{ vendorId: string; updatedAt: Date }> {
    return this.updateVendorUseCase.execute({ vendorId, ...body });
  }

  @Post(':vendorId/activate')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.admin')
  public async activate(@Param('vendorId') vendorId: string): Promise<{ vendorId: string; status: string }> {
    return this.activateVendorUseCase.execute({ vendorId });
  }

  @Post(':vendorId/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles('purchase.admin')
  public async deactivate(@Param('vendorId') vendorId: string): Promise<{ vendorId: string; status: string }> {
    return this.deactivateVendorUseCase.execute({ vendorId });
  }
}
