import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { SkipTenancy } from '@shared-kernel/decorators/skip-tenancy.decorator';
import { MetricsPort } from '../ports/metrics.port';

/**
 * Prometheus scrape endpoint (`GET /api/v1/metrics`) exposing the counters
 * recorded via MetricsPort. Exempt from TenancyAuthGuard so scrapers need no
 * tenant JWT — consider restricting it at the gateway in multi mode.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsPort) {}

  @SkipTenancy()
  @Get()
  async scrape(@Res() reply: FastifyReply): Promise<void> {
    const body = await this.metrics.getMetrics();
    reply
      .type(await this.metrics.getMetricsContentType())
      .status(200)
      .send(body);
  }
}
