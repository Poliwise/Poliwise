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
          if (proxied.statusCode !== undefined) {
            response.status(proxied.statusCode);
          }
          if (this.isBinaryResponse(proxied.data)) {
            return proxied.data;
          }
          return proxied.data;
        }
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        // Return binary responses (byte[], Buffer) from preview/download endpoints as-is
        if (this.isBinaryResponse(data)) {
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

  private isBinaryResponse(data: unknown): boolean {
    if (Buffer.isBuffer(data)) return true;
    if (data instanceof ArrayBuffer) return true;
    if (data instanceof Uint8Array) return true;
    if (data && typeof data === 'object') {
      const proto = Object.prototype.toString.call(data);
      if (proto === '[object Uint8Array]') return true;
      if (proto === '[object ArrayBuffer]') return true;
      if (proto === '[object Blob]') return true;
      if (proto === '[object ReadableStream]') return true;
      // Axios wraps binary in { data: Buffer } structure
      if ('data' in data && Buffer.isBuffer((data as { data: unknown }).data)) return true;
    }
    return false;
  }
}
