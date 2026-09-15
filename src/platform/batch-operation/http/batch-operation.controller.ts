import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Idempotent } from '@platform/idempotency/http/idempotent.decorator';
import type { FastifyReply } from 'fastify';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { normalizePageQuery } from '@shared-kernel/types/pagination';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import { CancelBatchOperationJobUseCase } from '../usecases/cancel-batch-operation-job.usecase';
import { CreateBatchOperationJobUseCase } from '../usecases/create-batch-operation-job.usecase';
import { GetBatchOperationJobStatusUseCase } from '../usecases/get-batch-operation-job-status.usecase';
import { ListBatchOperationJobRowsUseCase } from '../usecases/list-batch-operation-job-rows.usecase';
import { ListBatchOperationJobsUseCase } from '../usecases/list-batch-operation-jobs.usecase';
import { ValidateBatchOperationUseCase } from '../usecases/validate-batch-operation.usecase';
import { PageResult } from '@shared-kernel/types/pagination';
import {
  BatchOperationJobRecord,
  BatchOperationPreview,
  BatchOperationRowRecord,
} from '../batch-operation.types';
import { BatchOperationQueryDto } from './requests/batch-operation-query.request.dto';
import { SubmitBatchOperationDto } from './requests/submit-batch-operation.request.dto';
import { ValidateBatchOperationDto } from './requests/validate-batch-operation.request.dto';

/**
 * Generic entry point for every batch-capable aggregate and every operation.
 * Never interprets what an operationCode does — aggregateType / operationCode
 * are strings passed straight through to the pipeline.
 */
@ApiTags('batch-operations')
@ApiBearerAuth()
@Controller('batch-operations')
export class BatchOperationController {
  constructor(
    private readonly createJob: CreateBatchOperationJobUseCase,
    private readonly validatePreview: ValidateBatchOperationUseCase,
    private readonly getStatus: GetBatchOperationJobStatusUseCase,
    private readonly listJobs: ListBatchOperationJobsUseCase,
    private readonly listRows: ListBatchOperationJobRowsUseCase,
    private readonly cancelJob: CancelBatchOperationJobUseCase,
    private readonly registry: BatchOperationHandlerRegistry,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Get('_registry')
  @ApiOperation({ summary: 'List registered batch-capable aggregates and their operations' })
  listHandlers() {
    return { data: this.registry.health(), message: 'Batch operation handler registry' };
  }

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dry-run a batch operation — per-record preview, nothing persisted' })
  async validate(
    @Body() dto: ValidateBatchOperationDto,
  ): Promise<ApiResponse<BatchOperationPreview>> {
    const ctx = this.requestContext.get();
    const preview = await this.validatePreview.execute({
      aggregateType: dto.aggregateType,
      operationCode: dto.operationCode,
      entityIds: dto.entityIds,
      params: dto.params,
      tenantId: ctx?.tenantId,
    });
    return { data: preview, message: 'Batch operation preview' };
  }

  @Post()
  @Idempotent()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Submit a batch operation (Sync 200 with result, Async 202 with job)',
    description:
      'Requires an `Idempotency-Key` header: repeats with the same key replay the ' +
      'original response instead of creating a second job (platform/idempotency).',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Caller-generated unique key',
    required: true,
  })
  async submit(
    @Body() dto: SubmitBatchOperationDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<ApiResponse<BatchOperationJobRecord>> {
    const ctx = this.requestContext.get();
    const job = await this.createJob.execute({
      aggregateType: dto.aggregateType,
      operationCode: dto.operationCode,
      entityIds: dto.entityIds,
      params: dto.params,
      tenantId: ctx?.tenantId,
      requestedBy: ctx?.userId,
      traceId: ctx?.correlationId,
    });
    if (job.mode === 'ASYNC') {
      res.status(202);
    }
    return {
      data: job,
      message: `Batch operation ${job.mode === 'SYNC' ? 'completed' : 'accepted'}`,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List batch operation jobs' })
  async list(
    @Query() query: BatchOperationQueryDto,
  ): Promise<ApiResponse<PageResult<BatchOperationJobRecord>>> {
    const ctx = this.requestContext.get();
    const page = normalizePageQuery({ page: query.page, pageSize: query.pageSize });
    const jobs = await this.listJobs.execute({
      tenantId: ctx?.tenantId,
      status: query.status,
      aggregateType: query.aggregateType,
      page: page.page,
      pageSize: page.pageSize,
    });
    return { data: jobs, message: 'Batch operation jobs fetched' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a batch operation job status (header + counters)' })
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<BatchOperationJobRecord>> {
    const ctx = this.requestContext.get();
    const job = await this.getStatus.execute(id, ctx?.tenantId);
    return { data: job, message: 'Batch operation job fetched' };
  }

  @Get(':id/rows')
  @ApiOperation({ summary: 'List per-row outcomes for a batch operation job' })
  async getRows(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<BatchOperationRowRecord[]>> {
    const ctx = this.requestContext.get();
    const rows = await this.listRows.execute(id, ctx?.tenantId);
    return { data: rows, message: 'Batch operation job rows fetched' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Request cancellation of a running batch operation job' })
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<BatchOperationJobRecord>> {
    const ctx = this.requestContext.get();
    const job = await this.cancelJob.execute(id, ctx?.tenantId);
    return { data: job, message: 'Batch operation cancellation requested' };
  }
}
