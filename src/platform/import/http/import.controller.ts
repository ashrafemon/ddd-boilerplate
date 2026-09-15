import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CancelImportJobUseCase } from '../usecases/cancel-import-job.usecase';
import { CreateImportJobUseCase } from '../usecases/create-import-job.usecase';
import { CreateImportUploadUseCase } from '../usecases/create-import-upload.usecase';
import { ExecuteImportJobUseCase } from '../usecases/execute-import-job.usecase';
import { GetImportJobStatusUseCase } from '../usecases/get-import-job-status.usecase';
import { GetImportPreviewUseCase } from '../usecases/get-import-preview.usecase';
import { GetImportReportUseCase } from '../usecases/get-import-report.usecase';
import { InitImportUseCase } from '../usecases/init-import.usecase';
import { ListImportJobsUseCase } from '../usecases/list-import-jobs.usecase';
import { UpdateImportMappingUseCase } from '../usecases/update-import-mapping.usecase';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Idempotent } from '@platform/idempotency/http/idempotent.decorator';
import { normalizePageQuery } from '@shared-kernel/types/pagination';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { CreateJobDto } from './requests/create-import-job.request.dto';
import { CreateUploadDto } from './requests/create-import-upload.request.dto';
import { ImportJobQueryDto } from './requests/list-import-jobs.request.dto';
import { UpdateMappingDto } from './requests/update-import-mapping.request.dto';

@ApiTags('import')
@ApiBearerAuth()
@Controller('import')
export class ImportController {
  constructor(
    private readonly initImport: InitImportUseCase,
    private readonly createUpload: CreateImportUploadUseCase,
    private readonly createJob: CreateImportJobUseCase,
    private readonly getPreview: GetImportPreviewUseCase,
    private readonly updateMapping: UpdateImportMappingUseCase,
    private readonly getReport: GetImportReportUseCase,
    private readonly executeJob: ExecuteImportJobUseCase,
    private readonly cancelJob: CancelImportJobUseCase,
    private readonly getStatus: GetImportJobStatusUseCase,
    private readonly listJobs: ListImportJobsUseCase,
    private readonly registry: ImportHandlerRegistry,
  ) {}

  @Get('_registry')
  @ApiOperation({ summary: 'List registered import entityKeys' })
  listHandlers() {
    return { data: this.registry.health(), message: 'Import handler registry' };
  }

  @Post('uploads')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a presigned upload slot for an import source file' })
  async uploads(@Body() dto: CreateUploadDto, @Headers('idempotency-key') idempotencyKey?: string) {
    const data = await this.createUpload.execute({
      entityKey: dto.entityKey,
      contentType: dto.contentType,
      idempotencyKey,
    });
    return { data, message: 'Upload slot created' };
  }

  @Post('jobs')
  @Idempotent()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create an import job from a verified upload',
    description:
      'Requires an `Idempotency-Key` header: a retried POST replays the first ' +
      'job/response instead of creating a duplicate pipeline (platform/idempotency).',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Caller-generated unique key',
    required: true,
  })
  async create(@Body() dto: CreateJobDto) {
    const data = await this.createJob.execute({
      entityKey: dto.entityKey,
      storageObjectId: dto.storageObjectId,
      options: dto.options,
    });
    return { data, message: 'Import job created' };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List import jobs' })
  async list(@Query() query: ImportJobQueryDto) {
    const page = normalizePageQuery({ page: query.page, pageSize: query.pageSize });
    const data = await this.listJobs.execute({
      status: query.status,
      entityKey: query.entityKey,
      page: page.page,
      pageSize: page.pageSize,
    });
    return { data, message: 'Import jobs' };
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get import job status' })
  async status(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.getStatus.execute({ jobId: id });
    return { data, message: 'Import job' };
  }

  @Get('jobs/:id/preview')
  @ApiOperation({ summary: 'Preview parsed rows and suggested mapping' })
  async preview(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.getPreview.execute({ jobId: id });
    return { data, message: 'Import preview' };
  }

  @Patch('jobs/:id/mapping')
  @ApiOperation({ summary: 'Confirm column mapping and enqueue validation' })
  async mapping(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateMappingDto) {
    const data = await this.updateMapping.execute({
      jobId: id,
      mapping: dto.mapping,
    });
    return { data, message: 'Mapping saved; validation queued' };
  }

  @Get('jobs/:id/report')
  @ApiOperation({ summary: 'Paginated invalid-row report' })
  async report(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const p = normalizePageQuery({ page, pageSize });
    const data = await this.getReport.execute({
      jobId: id,
      page: p.page,
      pageSize: p.pageSize,
    });
    return { data, message: 'Import report' };
  }

  @Post('jobs/:id/execute')
  @ApiOperation({ summary: 'Execute a VALIDATED import job' })
  async execute(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.executeJob.execute({ jobId: id });
    return { data, message: 'Import execution queued' };
  }

  @Post('jobs/:id/cancel')
  @ApiOperation({ summary: 'Request cancellation of an import job' })
  async cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.cancelJob.execute({ jobId: id });
    return { data, message: 'Import cancel requested' };
  }

  @Get(':entityKey/init')
  @ApiOperation({ summary: 'Init import for an entityKey (descriptor, limits, recent jobs)' })
  async init(@Param('entityKey') entityKey: string) {
    const data = await this.initImport.execute({ entityKey });
    return { data, message: 'Import init' };
  }
}
