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
  private readonly fallbackStore = new Map<string, RateLimitRecord>();
  private readonly logger = new Logger(RateLimitInterceptor.name);
  private useRedis: boolean;
  private redisClient: any;

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

    // Try to initialize Redis
    this.useRedis = this.initRedis();

    setInterval(() => this.cleanupExpiredRecords(), 60000);
  }

  private initRedis(): boolean {
    try {
      const redis = require('redis');
      const host = this.configService.get<string>('redis.host') || 'localhost';
      const port = this.configService.get<number>('redis.port') || 6379;
      const password = this.configService.get<string>('redis.password');

      this.redisClient = redis.createClient({
        host,
        port,
        password: password || undefined,
      });

      this.redisClient.on('error', (err: Error) => {
        this.logger.warn(`Redis connection error, falling back to in-memory rate limiting: ${err.message}`);
        this.useRedis = false;
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis connected for distributed rate limiting');
      });

      this.redisClient.connect().catch(() => {
        this.useRedis = false;
      });

      return true;
    } catch (e: any) {
      this.logger.warn(`Redis not available, using in-memory rate limiting: ${e.message}`);
      return false;
    }
  }

  private cleanupExpiredRecords(): void {
    const now = Date.now();
    for (const [key, record] of this.fallbackStore.entries()) {
      if (now >= record.resetTime) {
        this.fallbackStore.delete(key);
      }
    }
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip rate limiting for health checks
    if (request.url === '/health' || request.url === '/api/v1/health') {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as IUserContext | undefined;

    const key = this.getRateLimitKey(request, user);
    const limit = this.getLimit(user);
    const now = Date.now();

    if (this.useRedis) {
      return this.handleWithRedis(key, limit, now, response, next);
    }
    return this.handleWithMemory(key, limit, now, response, next);
  }

  private async handleWithRedis(
    key: string,
    limit: number,
    now: number,
    response: Response,
    next: CallHandler
  ): Promise<Observable<unknown>> {
    const redisKey = `rate_limit:${key}`;
    const resetTime = now + this.ttl;

    try {
      const current = await this.redisClient.incr(redisKey);
      
      if (current === 1) {
        await this.redisClient.expire(redisKey, Math.ceil(this.ttl / 1000));
      }

      const ttl = await this.redisClient.ttl(redisKey);
      const remaining = Math.max(0, limit - current);

      response.setHeader('X-RateLimit-Limit', limit);
      response.setHeader('X-RateLimit-Remaining', remaining);
      response.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);

      if (current > limit) {
        const retryAfter = ttl;
        response.setHeader('Retry-After', retryAfter);
        this.logger.warn(`Rate limit exceeded for key: ${key}`);
        throw new HttpException(
          ErrorResponse.rateLimitExceeded(retryAfter),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (e) {
      this.logger.warn(`Redis operation failed, falling back to memory: ${(e as Error).message}`);
      return this.handleWithMemory(key, limit, now, response, next);
    }

    return next.handle().pipe(tap(() => {}));
  }

  private handleWithMemory(
    key: string,
    limit: number,
    now: number,
    response: Response,
    next: CallHandler
  ): Observable<unknown> {
    const record = this.fallbackStore.get(key);

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
      this.fallbackStore.set(key, {
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
    const forwardedFor = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];
    const ip = forwardedFor 
      ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]) 
      : (realIp || request.ip || request.socket.remoteAddress || 'unknown');
    return `ip:${ip}`;
  }

  private getLimit(user?: IUserContext): number {
    if (!user) {
      return this.limits['public'];
    }
    return this.limits[user.role] || this.limits[UserRole.USER];
  }
}