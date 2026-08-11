import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorCommandPort, VENDOR_COMMAND_PORT } from '../ports/inbound/vendor.command.port';
import { VendorQueryPort, VENDOR_QUERY_PORT } from '../ports/inbound/vendor.query.port';
import { VendorId } from '../domain/value-objects/vendor-id.vo';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from '../dto/vendor.dto';
import { PageQuery, normalizePageQuery } from '@shared-kernal/types/pagination';

@ApiTags('vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorController {
  constructor(
    @Inject(VENDOR_COMMAND_PORT) private readonly commands: VendorCommandPort,
    @Inject(VENDOR_QUERY_PORT) private readonly queries: VendorQueryPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a vendor' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateVendorDto) {
    const id = await this.commands.createVendor({ ...dto });
    return { data: { id: id.toString() }, message: 'Vendor created' };
  }

  @Get()
  @ApiOperation({ summary: 'List vendors' })
  async list(@Query() query: VendorQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.queries.listVendors(pageQuery);
    return { data: result, message: 'Vendors fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vendor by id' })
  async get(@Param('id') id: string) {
    const vendor = await this.queries.getVendor(VendorId.fromString(id));
    return { data: vendor, message: 'Vendor fetched' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor' })
  async update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    const vendorId = await this.commands.updateVendor({ id, ...dto });
    return { data: { id: vendorId.toString() }, message: 'Vendor updated' };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a vendor' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    const vendorId = await this.commands.activateVendor(id);
    return { data: { id: vendorId.toString() }, message: 'Vendor activated' };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a vendor' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    const vendorId = await this.commands.deactivateVendor(id);
    return { data: { id: vendorId.toString() }, message: 'Vendor deactivated' };
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a vendor' })
  @HttpCode(HttpStatus.OK)
  async block(@Param('id') id: string) {
    const vendorId = await this.commands.blockVendor(id);
    return { data: { id: vendorId.toString() }, message: 'Vendor blocked' };
  }
}
