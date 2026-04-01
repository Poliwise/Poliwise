import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { TRACE_ID_HEADER, sanitizeLogData } from '../utils';
import { IUserContext } from '../interfaces';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, body } = request;
    const traceId =
      (request.headers[TRACE_ID_HEADER.toLowerCase()] as string) || 'unknown';
    const user = request.user as IUserContext | undefined;
    const userId = user?.userId || 'anonymous';

    const startTime = Date.now();

    const sanitizedBody = body
      ? sanitizeLogData(body as Record<string, unknown>)
      : undefined;

    this.logger.log({
      type: 'REQUEST',
      traceId,
      method,
      url,
      userId,
      ip: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      body: sanitizedBody,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log({
            type: 'RESPONSE',
            traceId,
            method,
            url,
            statusCode: response.statusCode,
            duration,
            userId,
          });
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            type: 'RESPONSE_ERROR',
            traceId,
            method,
            url,
            statusCode: response.statusCode || 500,
            duration,
            userId,
            error: error.message,
            stack:
              process.env.NODE_ENV === 'development' ? error.stack : undefined,
          });
        },
      }),
    );
  }
}
