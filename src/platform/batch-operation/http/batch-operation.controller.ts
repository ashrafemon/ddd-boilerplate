import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { normalizePageQuery } from '@shared-kernel/types/pagination';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import { CancelBatchOperationJobPort } from '../ports/cancel-batch-operation-job.port';
import { CreateBatchOperationJobPort } from '../ports/create-batch-operation-job.port';
import { GetBatchOperationJobStatusPort } from '../ports/get-batch-operation-job-status.port';
import { ListBatchOperationJobRowsPort } from '../ports/list-batch-operation-job-rows.port';
import { ListBatchOperationJobsPort } from '../ports/list-batch-operation-jobs.port';
import { ValidateBatchOperationPort } from '../ports/validate-batch-operation.port';
import { PageResult } from '@shared-kernel/types/pagination';
import {
  BatchOperationJobRecord,
  BatchOperationPreview,
  BatchOperationRowRecord,
} from '../batch-operation.types';
import {
  BatchOperationQueryDto,
  SubmitBatchOperationDto,
  ValidateBatchOperationDto,
} from './requests/batch-operation.request.dto';

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
    private readonly createJob: CreateBatchOperationJobPort,
    private readonly validatePreview: ValidateBatchOperationPort,
    private readonly getStatus: GetBatchOperationJobStatusPort,
    private readonly listJobs: ListBatchOperationJobsPort,
    private readonly listRows: ListBatchOperationJobRowsPort,
    private readonly cancelJob: CancelBatchOperationJobPort,
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
  @ApiOperation({
    summary: 'Submit a batch operation (Sync 200 with result, Async 202 with job)',
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
  async get(@Param('id') id: string): Promise<ApiResponse<BatchOperationJobRecord>> {
    const job = await this.getStatus.execute(id);
    return { data: job, message: 'Batch operation job fetched' };
  }

  @Get(':id/rows')
  @ApiOperation({ summary: 'List per-row outcomes for a batch operation job' })
  async getRows(@Param('id') id: string): Promise<ApiResponse<BatchOperationRowRecord[]>> {
    const rows = await this.listRows.execute(id);
    return { data: rows, message: 'Batch operation job rows fetched' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Request cancellation of a running batch operation job' })
  async cancel(@Param('id') id: string): Promise<ApiResponse<BatchOperationJobRecord>> {
    const job = await this.cancelJob.execute(id);
    return { data: job, message: 'Batch operation cancellation requested' };
  }
}
