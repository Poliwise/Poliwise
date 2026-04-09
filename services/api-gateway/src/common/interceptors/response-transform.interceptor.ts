import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { ApiResponse } from '../dto';
import { TRACE_ID_HEADER } from '../utils';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const traceId =
      (request.headers[TRACE_ID_HEADER.toLowerCase()] as string) || undefined;

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && '_proxied' in data) {
          const proxied = data as { _proxied: boolean; data: unknown; statusCode?: number };
          // Apply the actual status from the proxied service so HTTP status matches body
          if (proxied.statusCode !== undefined) {
            response.status(proxied.statusCode);
          }
          return proxied.data;
        }
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return ApiResponse.success(data, undefined, traceId);
      }),
      catchError((error) => {
        this.logger.error(
          `Interceptor error: ${error.message}`,
          error.stack,
        );
        return throwError(() => error);
      }),
    );
  }
}
