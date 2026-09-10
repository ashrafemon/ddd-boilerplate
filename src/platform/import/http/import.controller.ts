import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { normalizePageQuery } from '@shared-kernel/types/pagination';
import { ImportHandlerRegistry } from '../import-handler.registry';
import {
  CancelImportJobPort,
  CreateImportJobPort,
  CreateImportUploadPort,
  ExecuteImportJobPort,
  GetImportJobStatusPort,
  GetImportPreviewPort,
  GetImportReportPort,
  InitImportPort,
  ListImportJobsPort,
  UpdateImportMappingPort,
} from '../ports/import.ports';
import {
  CreateJobDto,
  CreateUploadDto,
  ImportJobQueryDto,
  UpdateMappingDto,
} from './requests/import.request.dto';

@ApiTags('import')
@ApiBearerAuth()
@Controller('import')
export class ImportController {
  constructor(
    private readonly initImport: InitImportPort,
    private readonly createUpload: CreateImportUploadPort,
    private readonly createJob: CreateImportJobPort,
    private readonly getPreview: GetImportPreviewPort,
    private readonly updateMapping: UpdateImportMappingPort,
    private readonly getReport: GetImportReportPort,
    private readonly executeJob: ExecuteImportJobPort,
    private readonly cancelJob: CancelImportJobPort,
    private readonly getStatus: GetImportJobStatusPort,
    private readonly listJobs: ListImportJobsPort,
    private readonly registry: ImportHandlerRegistry,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Get('_registry')
  @ApiOperation({ summary: 'List registered import entityKeys' })
  listHandlers() {
    return { data: this.registry.health(), message: 'Import handler registry' };
  }

  @Post('uploads')
  @ApiOperation({ summary: 'Create a presigned upload slot for an import source file' })
  async uploads(@Body() dto: CreateUploadDto, @Headers('idempotency-key') idempotencyKey?: string) {
    const ctx = this.requestContext.get();
    const data = await this.createUpload.execute({
      entityKey: dto.entityKey,
      contentType: dto.contentType,
      tenantId: ctx?.tenantId,
      idempotencyKey,
    });
    return { data, message: 'Upload slot created' };
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create an import job from a verified upload' })
  async create(@Body() dto: CreateJobDto) {
    const ctx = this.requestContext.get();
    const data = await this.createJob.execute({
      entityKey: dto.entityKey,
      storageObjectId: dto.storageObjectId,
      options: dto.options,
      tenantId: ctx?.tenantId,
      requestedBy: ctx?.userId,
      traceId: ctx?.correlationId,
    });
    return { data, message: 'Import job created' };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List import jobs' })
  async list(@Query() query: ImportJobQueryDto) {
    const ctx = this.requestContext.get();
    const page = normalizePageQuery({ page: query.page, pageSize: query.pageSize });
    const data = await this.listJobs.execute({
      tenantId: ctx?.tenantId,
      status: query.status,
      entityKey: query.entityKey,
      page: page.page,
      pageSize: page.pageSize,
    });
    return { data, message: 'Import jobs' };
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get import job status' })
  async status(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const data = await this.getStatus.execute({ jobId: id, tenantId: ctx?.tenantId });
    return { data, message: 'Import job' };
  }

  @Get('jobs/:id/preview')
  @ApiOperation({ summary: 'Preview parsed rows and suggested mapping' })
  async preview(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const data = await this.getPreview.execute({ jobId: id, tenantId: ctx?.tenantId });
    return { data, message: 'Import preview' };
  }

  @Patch('jobs/:id/mapping')
  @ApiOperation({ summary: 'Confirm column mapping and enqueue validation' })
  async mapping(@Param('id') id: string, @Body() dto: UpdateMappingDto) {
    const ctx = this.requestContext.get();
    const data = await this.updateMapping.execute({
      jobId: id,
      mapping: dto.mapping,
      tenantId: ctx?.tenantId,
      actor: ctx?.userId,
    });
    return { data, message: 'Mapping saved; validation queued' };
  }

  @Get('jobs/:id/report')
  @ApiOperation({ summary: 'Paginated invalid-row report' })
  async report(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const ctx = this.requestContext.get();
    const p = normalizePageQuery({ page, pageSize });
    const data = await this.getReport.execute({
      jobId: id,
      tenantId: ctx?.tenantId,
      page: p.page,
      pageSize: p.pageSize,
    });
    return { data, message: 'Import report' };
  }

  @Post('jobs/:id/execute')
  @ApiOperation({ summary: 'Execute a VALIDATED import job' })
  async execute(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const data = await this.executeJob.execute({
      jobId: id,
      tenantId: ctx?.tenantId,
      actor: ctx?.userId,
    });
    return { data, message: 'Import execution queued' };
  }

  @Post('jobs/:id/cancel')
  @ApiOperation({ summary: 'Request cancellation of an import job' })
  async cancel(@Param('id') id: string) {
    const ctx = this.requestContext.get();
    const data = await this.cancelJob.execute({
      jobId: id,
      tenantId: ctx?.tenantId,
      actor: ctx?.userId,
    });
    return { data, message: 'Import cancel requested' };
  }

  @Get(':entityKey/init')
  @ApiOperation({ summary: 'Init import for an entityKey (descriptor, limits, recent jobs)' })
  async init(@Param('entityKey') entityKey: string) {
    const ctx = this.requestContext.get();
    const data = await this.initImport.execute({ entityKey, tenantId: ctx?.tenantId });
    return { data, message: 'Import init' };
  }
}
