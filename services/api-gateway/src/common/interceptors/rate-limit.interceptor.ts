import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IUserContext, UserRole } from '../interfaces';
import { ErrorResponse } from '../dto';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly ttl: number;
  private readonly limits: Record<string, number>;
  private readonly recordStore = new Map<string, RateLimitRecord>();
  private readonly logger = new Logger(RateLimitInterceptor.name);

  constructor(private readonly configService: ConfigService) {
    this.ttl = this.configService.get<number>('throttler.ttl') || 60000;
    this.limits = {
      [UserRole.USER]:
        this.configService.get<number>('throttler.limits.user') || 100,
      [UserRole.MANAGER]:
        this.configService.get<number>('throttler.limits.manager') || 200,
      [UserRole.ADMIN]:
        this.configService.get<number>('throttler.limits.admin') || 500,
      public: this.configService.get<number>('throttler.limits.public') || 20,
    };

    setInterval(() => this.cleanupExpiredRecords(), 60000);
  }

  private cleanupExpiredRecords(): void {
    const now = Date.now();
    for (const [key, record] of this.recordStore.entries()) {
      if (now >= record.resetTime) {
        this.recordStore.delete(key);
      }
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as IUserContext | undefined;

    const key = this.getRateLimitKey(request, user);
    const limit = this.getLimit(user);
    const now = Date.now();

    const record = this.recordStore.get(key);

    if (record && now < record.resetTime) {
      if (record.count >= limit) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);

        response.setHeader('X-RateLimit-Limit', limit);
        response.setHeader('X-RateLimit-Remaining', 0);
        response.setHeader(
          'X-RateLimit-Reset',
          Math.ceil(record.resetTime / 1000),
        );
        response.setHeader('Retry-After', retryAfter);

        this.logger.warn(`Rate limit exceeded for key: ${key}`);

        throw new HttpException(
          ErrorResponse.rateLimitExceeded(retryAfter),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      record.count++;
    } else {
      this.recordStore.set(key, {
        count: 1,
        resetTime: now + this.ttl,
      });
    }

    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, limit - (record?.count || 1)),
    );
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil((record?.resetTime || now + this.ttl) / 1000),
    );

    return next.handle().pipe(tap(() => {}));
  }

  private getRateLimitKey(request: Request, user?: IUserContext): string {
    if (user) {
      return `user:${user.userId}`;
    }
    return `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`;
  }

  private getLimit(user?: IUserContext): number {
    if (!user) {
      return this.limits['public'];
    }
    return this.limits[user.role] || this.limits[UserRole.USER];
  }
}
