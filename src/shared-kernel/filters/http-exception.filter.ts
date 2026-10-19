import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

interface ValidationErrorResponse {
  status: 'VALIDATE_ERROR';
  statusCode: number;
  data: Record<string, string>;
  message: string;
}

interface ErrorResponse {
  status: 'ERROR';
  statusCode: number;
  data: null;
  message: string;
}

interface ServerErrorResponse {
  status: 'SERVER_ERROR';
  statusCode: number;
  data: null;
  message: string;
}

@Catch()
export class HttpExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    // This filter is registered globally, so it also sees exceptions raised in
    // NON-HTTP contexts — a RabbitMQ/Kafka/SQS message handler, a cron, a
    // queue worker. Those have no HTTP response to write to: calling
    // `response.status(...)` there throws "response.status is not a function"
    // and MASKS the real error. For a non-HTTP context we log and rethrow so
    // the caller (the broker, the inbox) can see — and act on — the failure.
    if (host.getType() !== 'http') {
      this.logger.error(
        `Unhandled exception outside an HTTP request: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    if (exception instanceof BadRequestException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string' ? res : (res as { message?: string | string[] }).message;

      if (Array.isArray(message)) {
        const data: Record<string, string> = {};
        for (const msg of message) {
          if (typeof msg !== 'string') {
            continue;
          }

          const match = msg.match(/^(\w+)\s*/);
          if (match) {
            const key = match[1].toLowerCase();
            if (!data[key]) {
              data[key] = msg;
            }
          }
        }
        const body: ValidationErrorResponse = {
          status: 'VALIDATE_ERROR',
          statusCode: 422,
          data,
          message: 'Validation failed',
        };
        return response.status(422).send(body);
      }

      const body: ErrorResponse = {
        status: 'ERROR',
        statusCode: exception.getStatus(),
        data: null,
        message: typeof message === 'string' ? message : 'Bad request',
      };
      return response.status(exception.getStatus()).send(body);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message || exception.message;

      const body: ErrorResponse = {
        status: 'ERROR',
        statusCode: status,
        data: null,
        message: Array.isArray(message) ? message[0] : message,
      };
      return response.status(status).send(body);
    }

    if (
      exception instanceof Error &&
      typeof (exception as Error & { statusCode?: number }).statusCode === 'number'
    ) {
      const statusCode = (exception as Error & { statusCode: number }).statusCode;
      const body: ErrorResponse = {
        status: 'ERROR',
        statusCode,
        data: null,
        message: exception.message,
      };
      return response.status(statusCode).send(body);
    }

    const body: ServerErrorResponse = {
      status: 'SERVER_ERROR',
      statusCode: 500,
      data: null,
      message: 'Internal server error',
    };
    return response.status(500).send(body);
  }
}
