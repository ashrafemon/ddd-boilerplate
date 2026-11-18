import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { SkipTenancy } from '@common/http/decorators/skip-tenancy.decorator';
import { HealthPort } from '../inbound/ports/health.port';

/**
 * Readiness/liveness endpoint (`GET /api/v1/health`) for orchestrators and
 * load balancers. 200 when every enabled component is up, 503 when any is
 * down. Exempt from TenancyAuthGuard so probes need no tenant JWT — consider
 * restricting it at the gateway in multi mode.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthPort) {}

  @SkipTenancy()
  @Get()
  async check(@Res() reply: FastifyReply): Promise<void> {
    const report = await this.health.check();
    reply.status(report.status === 'ok' ? 200 : 503).send(report);
  }
}
