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
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { DeviceResponse } from '@shared-kernel/decorators/device-response.decorator';
import { PageQuery, normalizePageQuery } from '@shared-kernel/types/pagination';
import { CreateInvoiceUseCase } from '../../application/usecases/create-invoice.usecase';
import { GetInvoiceUseCase } from '../../application/usecases/get-invoice.usecase';
import { ListInvoicesUseCase } from '../../application/usecases/list-invoices.usecase';
import { PostInvoiceUseCase } from '../../application/usecases/post-invoice.usecase';
import { CreateInvoiceDto } from './requests/create-invoice.request.dto';
import { InvoiceQueryDto } from './requests/query-invoices.request.dto';
import {
  GetInvoiceMobileResponseDto,
  type GetInvoiceMobileResponse,
} from './responses/get-invoice.mobile.response.dto';
import {
  GetInvoiceWebResponseDto,
  type GetInvoiceWebResponse,
} from './responses/get-invoice.web.response.dto';
import {
  ListInvoicesMobileResponseDto,
  type ListInvoicesMobileResponse,
} from './responses/list-invoices.mobile.response.dto';
import {
  ListInvoicesWebResponseDto,
  type ListInvoicesWebResponse,
} from './responses/list-invoices.web.response.dto';
import { IdResponse } from './responses/id.response.dto';

type InvoiceGetResponse = GetInvoiceMobileResponse | GetInvoiceWebResponse;
type InvoiceListResponse = ListInvoicesMobileResponse | ListInvoicesWebResponse;

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly postInvoiceUseCase: PostInvoiceUseCase,
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft invoice' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateInvoiceDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.createInvoiceUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'Invoice created' };
  }

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @DeviceResponse(ListInvoicesMobileResponseDto, ListInvoicesWebResponseDto)
  async list(@Query() query: InvoiceQueryDto): Promise<ApiResponse<InvoiceListResponse>> {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listInvoicesUseCase.execute(pageQuery);
    return { data: result, message: 'Invoices fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by id' })
  @DeviceResponse(GetInvoiceMobileResponseDto, GetInvoiceWebResponseDto)
  async get(@Param('id') id: string): Promise<ApiResponse<InvoiceGetResponse>> {
    const invoice = await this.getInvoiceUseCase.execute(id);
    if (!invoice) {
      return { data: null as never, message: 'Invoice fetched' };
    }
    return { data: invoice, message: 'Invoice fetched' };
  }

  @Patch(':id/post')
  @ApiOperation({ summary: 'Post a draft invoice' })
  @HttpCode(HttpStatus.OK)
  async post(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const invoiceId = await this.postInvoiceUseCase.execute(id);
    return { data: { id: invoiceId.toString() }, message: 'Invoice posted' };
  }
}
