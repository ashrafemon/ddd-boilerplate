import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PageQuery, normalizePageQuery } from '@shared-kernel/types/pagination';
import { CreateGrnUseCase } from '../../application/usecase/create-grn.usecase';
import { AddGrnLineUseCase } from '../../application/usecase/add-grn-line.usecase';
import { ReceiveGrnUseCase } from '../../application/usecase/receive-grn.usecase';
import { CompleteGrnUseCase } from '../../application/usecase/complete-grn.usecase';
import { GetGrnUseCase } from '../../application/usecase/get-grn.usecase';
import { ListGrnsUseCase } from '../../application/usecase/list-grns.usecase';
import { CreateGrnDto } from './request/create-grn.request.dto';
import { AddGrnLineDto } from './request/add-grn-line.request.dto';
import { GrnQueryDto } from './request/query-grn.request.dto';
import { DeviceContext } from '@shared-kernel/decorators/device-context.decorator';
import { IDeviceContext } from '@shared-kernel/types/device-context';
import { GrnMobileListResponse } from './response/device/mobile/grn-list.response.dto';
import { GrnMobileResponse } from './response/device/mobile/grn.response.dto';
import { GrnWebListResponse } from './response/device/web/grn-list.response.dto';
import { GrnWebResponse } from './response/device/web/grn.response.dto';
import { GrnResponseTransformer } from './transformers/grn.response.transformer';
import { IdResponse } from './response/id.response.dto';

type SuccessResponse<T> = {
  data: T;
  message: string;
};

type GrnGetResponse = GrnMobileResponse | GrnWebResponse;
type GrnListResponse = GrnMobileListResponse | GrnWebListResponse;

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
  async create(@Body() dto: CreateGrnDto): Promise<SuccessResponse<IdResponse>> {
    const id = await this.createGrnUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'GRN created' };
  }

  @Get()
  @ApiOperation({ summary: 'List GRNs' })
  async list(
    @Query() query: GrnQueryDto,
    @DeviceContext() device: IDeviceContext,
  ): Promise<SuccessResponse<GrnListResponse>> {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listGrnsUseCase.execute(pageQuery);
    return {
      data: GrnResponseTransformer.toListResponse(result, device),
      message: 'GRNs fetched',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a GRN by id' })
  async get(
    @Param('id') id: string,
    @DeviceContext() device: IDeviceContext,
  ): Promise<SuccessResponse<GrnGetResponse>> {
    const grn = await this.getGrnUseCase.execute(id);
    if (!grn) {
      return { data: null as never, message: 'GRN fetched' };
    }
    return {
      data: GrnResponseTransformer.toResponse(grn, device),
      message: 'GRN fetched',
    };
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Add a line to a GRN' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(
    @Param('id') id: string,
    @Body() dto: AddGrnLineDto,
  ): Promise<SuccessResponse<IdResponse>> {
    const grnId = await this.addGrnLineUseCase.execute({ id, ...dto });
    return { data: { id: grnId.toString() }, message: 'Line added' };
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Receive a GRN' })
  @HttpCode(HttpStatus.OK)
  async receive(@Param('id') id: string): Promise<SuccessResponse<IdResponse>> {
    const grnId = await this.receiveGrnUseCase.execute({ id });
    return { data: { id: grnId.toString() }, message: 'GRN received' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a GRN' })
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string): Promise<SuccessResponse<IdResponse>> {
    const grnId = await this.completeGrnUseCase.execute(id);
    return { data: { id: grnId.toString() }, message: 'GRN completed' };
  }
}
