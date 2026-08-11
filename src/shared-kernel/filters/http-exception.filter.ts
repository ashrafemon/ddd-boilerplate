import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import {
  BusinessRuleViolationError,
  ConflictError,
  DomainError,
  InvalidStateTransitionError,
  NotFoundError,
  ValidationError,
} from '@business/shared-business/domain/domain.error';
import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';
import { PolicyViolateException } from '@business/shared-business/errors/policy-violate.error';

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

function toStatusCode(error: DomainError): number {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof InvalidStateTransitionError) return 409;
  if (error instanceof ConflictError) return 409;
  if (error instanceof ValidationError) return 422;
  if (error instanceof BusinessRuleViolationError) return 422;
  return 500;
}

@Catch()
export class HttpExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
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

    if (exception instanceof InvariantException || exception instanceof PolicyViolateException) {
      const body: ErrorResponse = {
        status: 'ERROR',
        statusCode: 422,
        data: null,
        message: exception.message,
      };
      return response.status(422).send(body);
    }

    if (exception instanceof DomainError) {
      const statusCode = toStatusCode(exception);
      const body: ErrorResponse = {
        status: 'ERROR',
        statusCode,
        data: null,
        message: exception.message,
      };
      return response.status(statusCode).send(body);
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

    const body: ServerErrorResponse = {
      status: 'SERVER_ERROR',
      statusCode: 500,
      data: null,
      message: 'Internal server error',
    };
    return response.status(500).send(body);
  }
}
