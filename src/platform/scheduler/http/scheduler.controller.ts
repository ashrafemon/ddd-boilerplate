import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '@shared-kernel/types/api-response.type';
import { ScheduledJobDispatchLogRecord } from '../scheduler.types';
import { ScheduledJobRecord } from '../scheduler.types';
import { SchedulerHealthMetrics } from '../scheduler.types';
import { SchedulerPort } from '../ports/scheduler.port';
import { ListScheduledJobsDto, UpdateScheduledJobDto } from './requests/scheduler.request.dto';
import { UpdateScheduledJobUseCase } from '../usecases/update-scheduled-job.usecase';
import { GetScheduledJobStatusUseCase } from '../usecases/get-scheduled-job-status.usecase';
import { ListScheduledJobDispatchLogUseCase } from '../usecases/list-scheduled-job-dispatch-log.usecase';
import { GetSchedulerHealthMetricsUseCase } from '../usecases/get-scheduler-health-metrics.usecase';

@ApiTags('scheduler')
@ApiBearerAuth()
@Controller('scheduled-jobs')
export class SchedulerController {
  constructor(
    private readonly getStatus: GetScheduledJobStatusUseCase,
    private readonly listDispatchLog: ListScheduledJobDispatchLogUseCase,
    private readonly updateJob: UpdateScheduledJobUseCase,
    private readonly scheduler: SchedulerPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List scheduled jobs' })
  async list(@Query() query: ListScheduledJobsDto): Promise<ApiResponse<ScheduledJobRecord[]>> {
    const data = await this.getStatus.list(query);
    return { data, message: 'Scheduled jobs' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled job status' })
  async get(@Param('id') id: string): Promise<ApiResponse<ScheduledJobRecord>> {
    const data = await this.getStatus.execute(id);
    return { data, message: 'Scheduled job' };
  }

  @Get(':id/dispatch-log')
  @ApiOperation({ summary: 'List dispatch history for a scheduled job' })
  async dispatchLog(
    @Param('id') id: string,
  ): Promise<ApiResponse<ScheduledJobDispatchLogRecord[]>> {
    const data = await this.listDispatchLog.execute(id);
    return { data, message: 'Dispatch log' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cron expression or nextRunAt (optimistic concurrency)' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateScheduledJobDto,
  ): Promise<ApiResponse<ScheduledJobRecord>> {
    await this.updateJob.execute({
      jobId: id,
      expectedVersion: body.expectedVersion,
      cronExpression: body.cronExpression,
      nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : undefined,
      editedBy: body.editedBy,
    });
    const data = await this.getStatus.execute(id);
    return { data, message: 'Scheduled job updated' };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a scheduled job' })
  async cancel(@Param('id') id: string): Promise<ApiResponse<{ id: string }>> {
    await this.scheduler.cancel(id);
    return { data: { id }, message: 'Scheduled job cancelled' };
  }
}

@ApiTags('scheduler')
@ApiBearerAuth()
@Controller('scheduler')
export class SchedulerHealthController {
  constructor(private readonly health: GetSchedulerHealthMetricsUseCase) {}

  @Get('health')
  @ApiOperation({ summary: 'Scheduler health metrics' })
  async healthMetrics(): Promise<ApiResponse<SchedulerHealthMetrics>> {
    const data = await this.health.execute();
    return { data, message: 'Scheduler health' };
  }
}
