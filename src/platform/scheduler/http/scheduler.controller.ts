import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { PageResult } from '@shared-kernel/types/pagination';
import { CancelScheduledJobUseCase } from '../usecases/cancel-scheduled-job.usecase';
import { GetScheduledJobStatusUseCase } from '../usecases/get-scheduled-job-status.usecase';
import { GetSchedulerHealthMetricsUseCase } from '../usecases/get-scheduler-health-metrics.usecase';
import { ListScheduledJobDispatchLogUseCase } from '../usecases/list-scheduled-job-dispatch-log.usecase';
import { RescheduleExternalJobUseCase } from '../usecases/reschedule-external-job.usecase';
import { UpdateScheduledJobUseCase } from '../usecases/update-scheduled-job.usecase';
import { ScheduledJobDispatchLogRecord, ScheduledJobRecord } from '../scheduler.types';
import { ListScheduledJobsDto } from './requests/list-scheduled-jobs.request.dto';
import { UpdateScheduledJobDto } from './requests/update-scheduled-job.request.dto';

@ApiTags('scheduler')
@ApiBearerAuth()
@Controller('scheduled-jobs')
export class SchedulerController {
  constructor(
    private readonly getStatus: GetScheduledJobStatusUseCase,
    private readonly listDispatchLog: ListScheduledJobDispatchLogUseCase,
    private readonly updateJob: UpdateScheduledJobUseCase,
    private readonly cancelJob: CancelScheduledJobUseCase,
    private readonly rescheduleJob: RescheduleExternalJobUseCase,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List scheduled jobs (paged, tenant-scoped)' })
  async list(
    @Query() query: ListScheduledJobsDto,
  ): Promise<ApiResponse<PageResult<ScheduledJobRecord>>> {
    const ctx = this.requestContext.get();
    const data = await this.getStatus.list({ ...query, tenantId: ctx?.tenantId });
    return { data, message: 'Scheduled jobs' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled job status' })
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<ScheduledJobRecord>> {
    const ctx = this.requestContext.get();
    const data = await this.getStatus.execute(id, ctx?.tenantId);
    return { data, message: 'Scheduled job' };
  }

  @Get(':id/dispatch-log')
  @ApiOperation({ summary: 'List dispatch history for a scheduled job' })
  async dispatchLog(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<ScheduledJobDispatchLogRecord[]>> {
    const ctx = this.requestContext.get();
    const data = await this.listDispatchLog.execute(id, { tenantId: ctx?.tenantId });
    return { data, message: 'Dispatch log' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cron expression or nextRunAt (optimistic concurrency)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateScheduledJobDto,
  ): Promise<ApiResponse<ScheduledJobRecord>> {
    const ctx = this.requestContext.get();
    await this.updateJob.execute({
      jobId: id,
      expectedVersion: body.expectedVersion,
      cronExpression: body.cronExpression,
      nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : undefined,
      editedBy: body.editedBy,
      tenantId: ctx?.tenantId,
    });
    const data = await this.getStatus.execute(id, ctx?.tenantId);
    return { data, message: 'Scheduled job updated' };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a scheduled job' })
  async cancel(@Param('id', new ParseUUIDPipe()) id: string): Promise<ApiResponse<{ id: string }>> {
    const ctx = this.requestContext.get();
    await this.cancelJob.execute(id, ctx?.tenantId);
    return { data: { id }, message: 'Scheduled job cancelled' };
  }

  @Post(':id/dispatch-now')
  @HttpCode(200)
  @ApiOperation({ summary: 'Force a job due-now (backfill / manual re-fire)' })
  async dispatchNow(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<ScheduledJobRecord>> {
    const ctx = this.requestContext.get();
    const data = await this.rescheduleJob.dispatchNow(id, ctx?.tenantId);
    return { data, message: 'Scheduled job queued for immediate dispatch' };
  }
}

@ApiTags('scheduler')
@ApiBearerAuth()
@Controller('scheduler')
export class SchedulerHealthController {
  constructor(private readonly health: GetSchedulerHealthMetricsUseCase) {}

  @Get('health')
  @ApiOperation({ summary: 'Scheduler health metrics' })
  async healthMetrics(): Promise<ApiResponse<HealthMetricsData>> {
    const data = await this.health.execute();
    return { data, message: 'Scheduler health' };
  }
}

type HealthMetricsData = Awaited<ReturnType<GetSchedulerHealthMetricsUseCase['execute']>>;
