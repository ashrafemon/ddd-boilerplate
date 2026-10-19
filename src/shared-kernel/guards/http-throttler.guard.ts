import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * HTTP-only throttling.
 *
 * `ThrottlerGuard` is registered as a global APP_GUARD, so it also runs for
 * the platform's NON-HTTP transports — a RabbitMQ/Kafka/SQS message handler,
 * a queue worker, a cron. There is no HTTP response there, and
 * `ThrottlerGuard.handleRequest` calls `res.header(...)` on it, which throws
 * "res.header is not a function" and takes the message handler down with it.
 *
 * Rate limiting is a transport-edge concern, so it simply does not apply
 * outside HTTP.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    return super.canActivate(context);
  }
}
