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
import { CreateGrnUseCase } from '../../application/usecases/create-grn.usecase';
import { AddGrnLineUseCase } from '../../application/usecases/add-grn-line.usecase';
import { ReceiveGrnUseCase } from '../../application/usecases/receive-grn.usecase';
import { CompleteGrnUseCase } from '../../application/usecases/complete-grn.usecase';
import { GetGrnUseCase } from '../../application/usecases/get-grn.usecase';
import { ListGrnsUseCase } from '../../application/usecases/list-grns.usecase';
import { CreateGrnDto } from './requests/create-grn.request.dto';
import { AddGrnLineDto } from './requests/add-grn-line.request.dto';
import { GrnQueryDto } from './requests/query-grns.request.dto';
import {
  GetGrnMobileResponseDto,
  type GetGrnMobileResponse,
} from './responses/get-grn.mobile.response.dto';
import { GetGrnWebResponseDto, type GetGrnWebResponse } from './responses/get-grn.web.response.dto';
import {
  ListGrnsMobileResponseDto,
  type ListGrnsMobileResponse,
} from './responses/list-grns.mobile.response.dto';
import {
  ListGrnsWebResponseDto,
  type ListGrnsWebResponse,
} from './responses/list-grns.web.response.dto';
import { IdResponse } from './responses/id.response.dto';
import { DeviceResponse } from '@shared-kernel/decorators/device-response.decorator';
import { ApiResponse } from '@shared-kernel/types/api-response.type';

type GrnGetResponse = GetGrnMobileResponse | GetGrnWebResponse;
type GrnListResponse = ListGrnsMobileResponse | ListGrnsWebResponse;

@ApiTags('grn')
@ApiBearerAuth()
@Controller('grn')
export class GrnController {
  constructor(
    private readonly createGrnUseCase: CreateGrnUseCase,
    private readonly addGrnLineUseCase: AddGrnLineUseCase,
    private readonly receiveGrnUseCase: ReceiveGrnUseCase,
    private readonly completeGrnUseCase: CompleteGrnUseCase,
    private readonly getGrnUseCase: GetGrnUseCase,
    private readonly listGrnsUseCase: ListGrnsUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a GRN' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateGrnDto): Promise<ApiResponse<IdResponse>> {
    const id = await this.createGrnUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'GRN created' };
  }

  @Get()
  @ApiOperation({ summary: 'List GRNs' })
  @DeviceResponse(ListGrnsMobileResponseDto, ListGrnsWebResponseDto)
  async list(@Query() query: GrnQueryDto): Promise<ApiResponse<GrnListResponse>> {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listGrnsUseCase.execute(pageQuery);
    return {
      data: result,
      message: 'GRNs fetched',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a GRN by id' })
  @DeviceResponse(GetGrnMobileResponseDto, GetGrnWebResponseDto)
  async get(@Param('id') id: string): Promise<ApiResponse<GrnGetResponse>> {
    const grn = await this.getGrnUseCase.execute(id);
    if (!grn) {
      return { data: null as never, message: 'GRN fetched' };
    }
    return {
      data: grn,
      message: 'GRN fetched',
    };
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Add a line to a GRN' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(
    @Param('id') id: string,
    @Body() dto: AddGrnLineDto,
  ): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.addGrnLineUseCase.execute({ id, ...dto });
    return { data: { id: grnId.toString() }, message: 'Line added' };
  }

  @Patch(':id/receive')
  @ApiOperation({ summary: 'Receive a GRN' })
  @HttpCode(HttpStatus.OK)
  async receive(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.receiveGrnUseCase.execute({ id });
    return { data: { id: grnId.toString() }, message: 'GRN received' };
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete a GRN' })
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.completeGrnUseCase.execute(id);
    return { data: { id: grnId.toString() }, message: 'GRN completed' };
  }
}
