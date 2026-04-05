import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProxyService, ServiceName } from '../proxy/proxy.service';
import { Public } from '../common/decorators';

@Controller('api/v1/auth')
export class AuthProxyController {
  private readonly logger = new Logger(AuthProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  handleLogin(@Req() request: Request) {
    this.logger.debug(`Login request body: ${JSON.stringify(request.body)}`);
    const path = '/api/v1/auth/login';
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  handleRegister(@Req() request: Request) {
    const path = '/api/v1/auth/register';
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  handleRefresh(@Req() request: Request) {
    const path = '/api/v1/auth/refresh';
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }
}
