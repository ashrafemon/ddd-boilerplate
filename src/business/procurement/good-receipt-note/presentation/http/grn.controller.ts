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
  async create(@Body() dto: CreateGrnDto) {
    const id = await this.createGrnUseCase.execute({ ...dto });
    return { data: { id: id.toString() }, message: 'GRN created' };
  }

  @Get()
  @ApiOperation({ summary: 'List GRNs' })
  async list(@Query() query: GrnQueryDto) {
    const pageQuery: PageQuery = normalizePageQuery(query);
    const result = await this.listGrnsUseCase.execute(pageQuery);
    return { data: result, message: 'GRNs fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a GRN by id' })
  async get(@Param('id') id: string) {
    const grn = await this.getGrnUseCase.execute(id);
    return { data: grn, message: 'GRN fetched' };
  }

  @Post(':id/lines')
  @ApiOperation({ summary: 'Add a line to a GRN' })
  @HttpCode(HttpStatus.CREATED)
  async addLine(@Param('id') id: string, @Body() dto: AddGrnLineDto) {
    const grnId = await this.addGrnLineUseCase.execute({ id, ...dto });
    return { data: { id: grnId.toString() }, message: 'Line added' };
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Receive a GRN' })
  @HttpCode(HttpStatus.OK)
  async receive(@Param('id') id: string) {
    const grnId = await this.receiveGrnUseCase.execute({ id });
    return { data: { id: grnId.toString() }, message: 'GRN received' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a GRN' })
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    const grnId = await this.completeGrnUseCase.execute(id);
    return { data: { id: grnId.toString() }, message: 'GRN completed' };
  }
}
