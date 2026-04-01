import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, timeout, catchError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs = 30000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof Error && err.message.includes('Timeout')) {
          throw new RequestTimeoutException('Request timeout');
        }
        throw err;
      }),
    );
  }
}
