import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContext } from '../../ports/context/request-context';

/**
 * Injects the current request context (or a specific field of it).
 */
export const CurrentContext = createParamDecorator(
  (data: keyof RequestContext | undefined, context: ExecutionContext): unknown => {
    const request = context.switchToHttp().getRequest<Request & { __requestContext?: RequestContext }>();
    const requestContext = request.__requestContext;
    if (!data) {
      return requestContext;
    }
    return requestContext ? requestContext[data] : undefined;
  },
);
