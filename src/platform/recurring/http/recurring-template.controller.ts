import { Body, Controller, Get, Param, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateRecurringTemplateUseCase } from '../usecases/create-recurring-template.usecase';
import { PauseRecurringTemplateUseCase } from '../usecases/pause-recurring-template.usecase';
import { ResumeRecurringTemplateUseCase } from '../usecases/resume-recurring-template.usecase';
import { CancelRecurringTemplateUseCase } from '../usecases/cancel-recurring-template.usecase';
import { GetRecurringTemplateUseCase } from '../usecases/get-recurring-template.usecase';
import { ListRecurringTemplatesUseCase } from '../usecases/list-recurring-templates.usecase';
import { CreateRecurringTemplateDto } from './requests/create-recurring-template.request.dto';
import { RecurringTemplateQueryDto } from './requests/list-recurring-templates.request.dto';

@ApiTags('recurring-templates')
@ApiBearerAuth()
@Controller('recurring-templates')
export class RecurringTemplateController {
  constructor(
    private readonly createUseCase: CreateRecurringTemplateUseCase,
    private readonly pauseUseCase: PauseRecurringTemplateUseCase,
    private readonly resumeUseCase: ResumeRecurringTemplateUseCase,
    private readonly cancelUseCase: CancelRecurringTemplateUseCase,
    private readonly getUseCase: GetRecurringTemplateUseCase,
    private readonly listUseCase: ListRecurringTemplatesUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring template' })
  async create(@Body() dto: CreateRecurringTemplateDto) {
    const template = await this.createUseCase.execute({
      ...dto,
      currency: dto.currency ?? 'USD',
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
    return { data: template, message: 'Recurring template created' };
  }

  @Get()
  @ApiOperation({ summary: 'List recurring templates' })
  async list(@Query() query: RecurringTemplateQueryDto) {
    const pageSize = query.pageSize ?? 50;
    const templates = await this.listUseCase.execute({
      status: query.status,
      limit: pageSize,
      offset: (query.page ?? 1) > 1 ? ((query.page ?? 1) - 1) * pageSize : 0,
    });
    return { data: templates, message: 'Recurring templates fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring template by id' })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    const template = await this.getUseCase.execute(id);
    return { data: template, message: 'Recurring template fetched' };
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a recurring template' })
  async pause(@Param('id', new ParseUUIDPipe()) id: string) {
    const template = await this.pauseUseCase.execute(id);
    return { data: template, message: 'Recurring template paused' };
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a recurring template' })
  async resume(@Param('id', new ParseUUIDPipe()) id: string) {
    const template = await this.resumeUseCase.execute(id);
    return { data: template, message: 'Recurring template resumed' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a recurring template' })
  async cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    const template = await this.cancelUseCase.execute(id);
    return { data: template, message: 'Recurring template cancelled' };
  }
}
