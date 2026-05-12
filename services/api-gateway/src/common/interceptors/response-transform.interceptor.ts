import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { ApiResponse } from '../dto';
import { TRACE_ID_HEADER } from '../utils';

interface ProxiedResponse {
  _proxied: boolean;
  data: unknown;
  statusCode?: number;
  headers?: Record<string, string>;
}

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const traceId =
      (request.headers[TRACE_ID_HEADER.toLowerCase()] as string) || undefined;

    return next.handle().pipe(
      tap((data) => this.handleProxiedResponse(response, data)),
      map((data) => this.transformResponse(data, response, traceId)),
      catchError((error) => {
        this.logger.error(`Interceptor error: ${error.message}`, error.stack);
        return throwError(() => error);
      }),
    );
  }

  private handleProxiedResponse(response: Response, data: unknown): void {
    if (response.headersSent) return;
    if (!this.isProxiedResponse(data)) return;

    const proxied = data as ProxiedResponse;
    if (!this.isBinaryResponse(proxied.data)) return;

    const status = proxied.statusCode ?? 200;
    response.status(status);
    this.copyHeaders(response, proxied.headers);
    this.setContentLength(response, proxied.data);
    response.end(this.extractBinary(proxied.data));
  }

  private transformResponse(
    data: unknown,
    response: Response,
    traceId?: string,
  ): unknown {
    if (this.isProxiedResponse(data)) {
      const proxied = data as ProxiedResponse;
      if (this.isBinaryResponse(proxied.data)) {
        return undefined;
      }
      if (proxied.statusCode !== undefined) {
        response.status(proxied.statusCode);
      }
      this.copyHeaders(response, proxied.headers);
      return proxied.data;
    }
    if (this.isApiSuccessResponse(data)) {
      return data;
    }
    if (this.isBinaryResponse(data)) {
      return data;
    }
    return ApiResponse.success(data, undefined, traceId);
  }

  private isProxiedResponse(data: unknown): boolean {
    return data !== null && typeof data === 'object' && '_proxied' in data;
  }

  private isApiSuccessResponse(data: unknown): boolean {
    return data !== null && typeof data === 'object' && 'success' in data;
  }

  private isBinaryResponse(data: unknown): boolean {
    if (data === null || data === undefined) return false;
    const proto = Object.prototype.toString.call(data);
    if (proto === '[object ArrayBuffer]') return true;
    if (proto === '[object Uint8Array]') return true;
    if (proto === '[object Blob]') return true;
    if (proto === '[object ReadableStream]') return true;
    if (Buffer.isBuffer(data)) return true;
    if (this.isProxiedResponse(data)) {
      return this.isBinaryResponse((data as ProxiedResponse).data);
    }
    return false;
  }

  private extractBinary(data: unknown): Buffer | ArrayBuffer | Blob {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return data;
    if (data instanceof Uint8Array) return data.buffer as ArrayBuffer;
    return data as Buffer | ArrayBuffer | Blob;
  }

  private copyHeaders(
    response: Response,
    headers?: Record<string, string>,
  ): void {
    if (!headers) return;
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }
  }

  private setContentLength(response: Response, data: unknown): void {
    const size = this.getBinarySize(data);
    if (size > 0) {
      response.setHeader('content-length', String(size));
    }
  }

  private getBinarySize(data: unknown): number {
    if (Buffer.isBuffer(data)) return data.length;
    const proto = Object.prototype.toString.call(data);
    if (proto === '[object ArrayBuffer]') return (data as ArrayBuffer).byteLength;
    if (proto === '[object Uint8Array]') return (data as Uint8Array).length;
    return 0;
  }
}
