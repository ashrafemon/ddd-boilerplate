import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { CreateRecurringTemplateUseCase } from '../usecases/create-recurring-template.usecase';
import { PauseRecurringTemplateUseCase } from '../usecases/pause-recurring-template.usecase';
import { ResumeRecurringTemplateUseCase } from '../usecases/resume-recurring-template.usecase';
import { CancelRecurringTemplateUseCase } from '../usecases/cancel-recurring-template.usecase';
import { GetRecurringTemplateUseCase } from '../usecases/get-recurring-template.usecase';
import { ListRecurringTemplatesUseCase } from '../usecases/list-recurring-templates.usecase';
import {
  CreateRecurringTemplateDto,
  RecurringTemplateQueryDto,
} from './requests/recurring-template.request.dto';

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
    private readonly requestContext: RequestContextPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring template' })
  async create(@Body() dto: CreateRecurringTemplateDto) {
    const ctx = this.requestContext.get();
    const template = await this.createUseCase.execute({
      ...dto,
      currency: dto.currency ?? 'USD',
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      tenantId: ctx?.tenantId,
      createdBy: ctx?.userId,
    });
    return { data: template, message: 'Recurring template created' };
  }

  @Get()
  @ApiOperation({ summary: 'List recurring templates' })
  async list(@Query() query: RecurringTemplateQueryDto) {
    const ctx = this.requestContext.get();
    const templates = await this.listUseCase.execute({
      tenantId: ctx?.tenantId,
      status: query.status,
    });
    return { data: templates, message: 'Recurring templates fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring template by id' })
  async get(@Param('id') id: string) {
    const template = await this.getUseCase.execute(id);
    return { data: template, message: 'Recurring template fetched' };
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a recurring template' })
  async pause(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const template = await this.pauseUseCase.execute(id, ctx?.userId);
    return { data: template, message: 'Recurring template paused' };
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a recurring template' })
  async resume(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const template = await this.resumeUseCase.execute(id, ctx?.userId);
    return { data: template, message: 'Recurring template resumed' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a recurring template' })
  async cancel(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const template = await this.cancelUseCase.execute(id, ctx?.userId);
    return { data: template, message: 'Recurring template cancelled' };
  }
}
