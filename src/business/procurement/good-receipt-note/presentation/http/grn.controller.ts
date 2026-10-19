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
import { PostGrnUseCase } from '../../application/usecases/post-grn.usecase';
import { ReverseGrnUseCase } from '../../application/usecases/reverse-grn.usecase';
import { RecordInspectionResultUseCase } from '../../application/usecases/record-inspection-result.usecase';
import { CancelGrnUseCase } from '../../application/usecases/cancel-grn.usecase';
import { GetGrnUseCase } from '../../application/usecases/get-grn.usecase';
import { ListGrnsUseCase } from '../../application/usecases/list-grns.usecase';
import { CreateGrnDto } from './requests/create-grn.request.dto';
import { AddGrnLineDto } from './requests/add-grn-line.request.dto';
import { PostGrnDto } from './requests/post-grn.request.dto';
import { ReverseGrnDto } from './requests/reverse-grn.request.dto';
import { RecordInspectionResultDto } from './requests/record-inspection-result.request.dto';
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
    private readonly postGrnUseCase: PostGrnUseCase,
    private readonly reverseGrnUseCase: ReverseGrnUseCase,
    private readonly recordInspectionResultUseCase: RecordInspectionResultUseCase,
    private readonly cancelGrnUseCase: CancelGrnUseCase,
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

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a GRN' })
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.cancelGrnUseCase.execute(id);
    return { data: { id: grnId.toString() }, message: 'GRN cancelled' };
  }

  @Patch(':id/inspection')
  @ApiOperation({ summary: 'Record accepted/rejected quantities per GRN line' })
  @HttpCode(HttpStatus.OK)
  async recordInspection(
    @Param('id') id: string,
    @Body() dto: RecordInspectionResultDto,
  ): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.recordInspectionResultUseCase.execute({ id, ...dto });
    return { data: { id: grnId.toString() }, message: 'Inspection result recorded' };
  }

  @Post(':id/post')
  @ApiOperation({ summary: 'Post a GRN (idempotent)' })
  @HttpCode(HttpStatus.OK)
  async post(@Param('id') id: string, @Body() dto: PostGrnDto): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.postGrnUseCase.execute({ id, ...dto });
    return { data: { id: grnId.toString() }, message: 'GRN posted' };
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reverse a posted GRN via a compensating document' })
  @HttpCode(HttpStatus.OK)
  async reverse(
    @Param('id') id: string,
    @Body() dto: ReverseGrnDto,
  ): Promise<ApiResponse<IdResponse>> {
    const grnId = await this.reverseGrnUseCase.execute({ id, ...dto });
    return { data: { id: grnId.toString() }, message: 'GRN reversed' };
  }
}
