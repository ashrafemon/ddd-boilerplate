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
import { CreateVendorUseCase } from '../../application/usecases/create-vendor.usecase';
import { GetVendorUseCase } from '../../application/usecases/get-vendor.usecase';
import { ListVendorsUseCase } from '../../application/usecases/list-vendors.usecase';
import { UpdateVendorUseCase } from '../../application/usecases/update-vendor.usecase';
import { VendorStatusUseCase } from '../../application/usecases/vendor-status.usecase';
import { CreateVendorDto } from './requests/create-vendor.request.dto';
import { UpdateVendorDto } from './requests/update-vendor.request.dto';
import { VendorQueryDto } from './requests/query-vendors.request.dto';
import {
  GetVendorMobileResponseSchema,
  type GetVendorMobileResponse,
} from './responses/get-vendor.mobile.response.dto';
import {
  GetVendorWebResponseSchema,
  type GetVendorWebResponse,
} from './responses/get-vendor.web.response.dto';
import {
  ListVendorsMobileResponseSchema,
  type ListVendorsMobileResponse,
} from './responses/list-vendors.mobile.response.dto';
import {
  ListVendorsWebResponseSchema,
  type ListVendorsWebResponse,
} from './responses/list-vendors.web.response.dto';
import { IdResponse } from './responses/id.response.dto';
import { DeviceResponse } from '@shared-kernel/decorators/device-response.decorator';
import { ApiResponse } from '@shared-kernel/types/api-response.type';

type VendorGetResponse = GetVendorMobileResponse | GetVendorWebResponse;
type VendorListResponse = ListVendorsMobileResponse | ListVendorsWebResponse;

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
  async create(@Body() dto: CreateVendorDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.createVendorUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Vendor created' };
  }

  @Get()
  @ApiOperation({ summary: 'List vendors' })
  @DeviceResponse(ListVendorsMobileResponseSchema, ListVendorsWebResponseSchema)
  async list(@Query() query: VendorQueryDto): Promise<ApiResponse<VendorListResponse>> {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listVendorsUseCase.execute(pageQuery);
    return {
      data: result,
      message: 'Vendors fetched',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vendor by id' })
  @DeviceResponse(GetVendorMobileResponseSchema, GetVendorWebResponseSchema)
  async get(@Param('id') id: string): Promise<ApiResponse<VendorGetResponse>> {
    const vendor = await this.getVendorUseCase.execute(id);
    if (!vendor) {
      return { data: null as never, message: 'Vendor fetched' };
    }
    return {
      data: vendor,
      message: 'Vendor fetched',
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ): Promise<ApiResponse<IdResponse>> {
    const vendorId = await this.updateVendorUseCase.execute({ id, ...dto });
    return { data: { id: vendorId.toString() }, message: 'Vendor updated' };
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a vendor' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const vendorId = await this.vendorStatusUseCase.execute({ id, action: 'activate' });
    return { data: { id: vendorId.toString() }, message: 'Vendor activated' };
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a vendor' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const vendorId = await this.vendorStatusUseCase.execute({ id, action: 'deactivate' });
    return { data: { id: vendorId.toString() }, message: 'Vendor deactivated' };
  }

  @Patch(':id/block')
  @ApiOperation({ summary: 'Block a vendor' })
  @HttpCode(HttpStatus.OK)
  async block(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const vendorId = await this.vendorStatusUseCase.execute({ id, action: 'block' });
    return { data: { id: vendorId.toString() }, message: 'Vendor blocked' };
  }
}
