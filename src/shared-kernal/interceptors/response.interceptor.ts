import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const NESTLENS_PATHS = ['/nestlens', '/__nestlens__'];

export interface SuccessResponse<T = unknown> {
  status: 'SUCCESS';
  statusCode: number;
  data: T | T[];
  message: string;
}

type WrappedResponse<T> = { data: T | T[]; message: string };

function isWrappedResponse<T>(value: unknown): value is WrappedResponse<T> {
  return typeof value === 'object' && value !== null && 'data' in value && 'message' in value;
}

function isNestLensRequest(request: FastifyRequest): boolean {
  const url = request.url ?? request.raw?.url ?? '';
  return NESTLENS_PATHS.some(path => url === path || url.startsWith(`${path}/`));
}

@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const response = http.getResponse<FastifyReply>();
    const statusCode = response.statusCode;
    const contentType = response.getHeader('content-type');

    if (isNestLensRequest(request)) {
      return next.handle() as Observable<SuccessResponse<T>>;
    }

    return next.handle().pipe(
      map((data: T | WrappedResponse<T>) => {
        if (isWrappedResponse(data)) {
          return {
            status: 'SUCCESS' as const,
            statusCode,
            data: data.data,
            message: data.message,
          };
        }
        if (
          data instanceof StreamableFile ||
          (typeof contentType === 'string' && !contentType.includes('application/json'))
        ) {
          return data as unknown as SuccessResponse<T>;
        }
        return {
          status: 'SUCCESS' as const,
          statusCode,
          data,
          message: 'Request processed successfully',
        };
      }),
    );
  }
}
