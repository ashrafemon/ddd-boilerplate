import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PageQuery, normalizePageQuery } from '@shared-kernel/types/pagination';
import { CreateVendorUseCase } from '../../application/usecase/create-vendor.usecase';
import { GetVendorUseCase } from '../../application/usecase/get-vendor.usecase';
import { ListVendorsUseCase } from '../../application/usecase/list-vendors.usecase';
import { UpdateVendorUseCase } from '../../application/usecase/update-vendor.usecase';
import { VendorStatusUseCase } from '../../application/usecase/vendor-status.usecase';
import { CreateVendorDto } from './request/create.vendor.request.dto';
import { UpdateVendorDto } from './request/update.vendor.request.dto';
import { VendorQueryDto } from './request/query.vendor.request.dto';

@ApiTags('vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorController {
  constructor(
    private readonly createVendorUseCase: CreateVendorUseCase,
    private readonly updateVendorUseCase: UpdateVendorUseCase,
    private readonly vendorStatusUseCase: VendorStatusUseCase,
    private readonly getVendorUseCase: GetVendorUseCase,
    private readonly listVendorsUseCase: ListVendorsUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a vendor' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateVendorDto) {
    const id = await this.createVendorUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Vendor created' };
  }

  @Get()
  @ApiOperation({ summary: 'List vendors' })
  async list(@Query() query: VendorQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listVendorsUseCase.execute(pageQuery);
    return { data: result, message: 'Vendors fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vendor by id' })
  async get(@Param('id') id: string) {
    const vendor = await this.getVendorUseCase.execute(id);
    return { data: vendor, message: 'Vendor fetched' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor' })
  async update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    const vendorId = await this.updateVendorUseCase.execute({ id, ...dto });
    return { data: { id: vendorId.toString() }, message: 'Vendor updated' };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a vendor' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    const vendorId = await this.vendorStatusUseCase.execute({ id, action: 'activate' });
    return { data: { id: vendorId.toString() }, message: 'Vendor activated' };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a vendor' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    const vendorId = await this.vendorStatusUseCase.execute({ id, action: 'deactivate' });
    return { data: { id: vendorId.toString() }, message: 'Vendor deactivated' };
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a vendor' })
  @HttpCode(HttpStatus.OK)
  async block(@Param('id') id: string) {
    const vendorId = await this.vendorStatusUseCase.execute({ id, action: 'block' });
    return { data: { id: vendorId.toString() }, message: 'Vendor blocked' };
  }
}
