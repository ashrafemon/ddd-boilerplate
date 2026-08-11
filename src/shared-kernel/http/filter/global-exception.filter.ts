import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError, ApiFailure } from '../../types/api-response';
import { AggregateNotFoundException } from '../../exceptions/aggregate-not-found.exception';
import { ConflictException } from '../../exceptions/conflict.exception';
import { DomainException } from '../../exceptions/domain.exception';
import { ForbiddenException } from '../../exceptions/forbidden.exception';
import { InfrastructureException } from '../../exceptions/infrastructure.exception';
import { InvariantViolationException } from '../../exceptions/invariant-violation.exception';
import { PolicyViolationException } from '../../exceptions/policy-violation.exception';
import { UnauthorizedException } from '../../exceptions/unauthorized.exception';
import { ValidationException } from '../../exceptions/validation.exception';

interface ExceptionMapping {
  statusCode: HttpStatus;
  code: string;
  message: string;
  details?: unknown;
}

const HTTP_ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

/**
 * Global exception filter. Maps domain/application/infrastructure exceptions to
 * HTTP responses using a structured error envelope. Never leaks internal error
 * details to clients; unknown errors are logged and returned as 500.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const mapping = this.mapException(exception);

    if (mapping.statusCode >= 500) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const error: ApiError = {
      statusCode: mapping.statusCode,
      code: mapping.code,
      message: mapping.message,
      details: mapping.details,
      requestId: request.headers['x-request-id'] as string | undefined,
      correlationId: request.headers['x-correlation-id'] as string | undefined,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    const body: ApiFailure = { success: false, error, timestamp: error.timestamp };

    response.status(mapping.statusCode).json(body);
  }

  private mapException(exception: unknown): ExceptionMapping {
    if (exception instanceof ValidationException) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: exception.code,
        message: exception.message,
        details: { issues: exception.issues },
      };
    }

    if (exception instanceof InvariantViolationException) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: exception.code,
        message: exception.message,
        details: { violations: exception.violations },
      };
    }

    if (exception instanceof PolicyViolationException || exception instanceof ForbiddenException) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (
      exception instanceof AggregateNotFoundException ||
      exception instanceof ConflictException ||
      exception instanceof UnauthorizedException ||
      exception instanceof InfrastructureException
    ) {
      const map: Record<string, HttpStatus> = {
        AGGREGATE_NOT_FOUND: HttpStatus.NOT_FOUND,
        ENTITY_NOT_FOUND: HttpStatus.NOT_FOUND,
        CONFLICT: HttpStatus.CONFLICT,
        UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
        INFRASTRUCTURE_ERROR: HttpStatus.SERVICE_UNAVAILABLE,
      };
      return {
        statusCode: map[exception.code] ?? HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof DomainException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message ?? exception.message;
      return {
        statusCode,
        code: HTTP_ERROR_CODES[statusCode] ?? 'HTTP_ERROR',
        message: typeof message === 'string' ? message : JSON.stringify(message),
        details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
      };
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message,
    };
  }
}
