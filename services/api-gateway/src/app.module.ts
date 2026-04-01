import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { createWinstonConfig } from './logging/winston.config';
import {
  appConfig,
  jwtConfig,
  corsConfig,
  servicesConfig,
  circuitBreakerConfig,
  loggingConfig,
} from './config';
import { AppController } from './app.controller';
import { AuthModule } from './auth';
import { ProxyModule } from './proxy';
import { HealthModule } from './health';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { HttpExceptionFilter } from './common/filters';
import {
  LoggingInterceptor,
  TraceIdInterceptor,
  ResponseTransformInterceptor,
  TimeoutInterceptor,
  RateLimitInterceptor,
} from './common/interceptors';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        corsConfig,
        servicesConfig,
        circuitBreakerConfig,
        loggingConfig,
      ],
      envFilePath: '.env',
    }),
    WinstonModule.forRoot(createWinstonConfig()),
    AuthModule,
    ProxyModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TraceIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
})
export class AppModule {}
