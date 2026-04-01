import {
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  All,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProxyService, ServiceName } from './proxy.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/interfaces';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('users/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleUsers(@Req() request: Request) {
    const path = request.url.replace('/api/v1/users', '');
    return this.proxyService.forward(ServiceName.USER, request, path);
  }

  @All('documents/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleDocuments(@Req() request: Request) {
    const path = request.url.replace('/api/v1/documents', '');
    return this.proxyService.forward(ServiceName.KNOWLEDGE, request, path);
  }

  @Post('documents/upload')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  handleDocumentUpload(@Req() request: Request) {
    const path = request.url.replace('/api/v1/documents', '');
    return this.proxyService.forward(ServiceName.KNOWLEDGE, request, path);
  }

  @All('metadata/*')
  @Roles(UserRole.ADMIN)
  handleMetadata(@Req() request: Request) {
    const path = request.url.replace('/api/v1/metadata', '');
    return this.proxyService.forward(ServiceName.METADATA, request, path);
  }

  @All('feedback/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleFeedback(@Req() request: Request) {
    const path = request.url.replace('/api/v1/feedback', '');
    return this.proxyService.forward(ServiceName.FEEDBACK, request, path);
  }

  @All('analytics/*')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  handleAnalytics(@Req() request: Request) {
    const path = request.url.replace('/api/v1/analytics', '');
    return this.proxyService.forward(ServiceName.FEEDBACK, request, path);
  }

  @All('ai/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAI(@Req() request: Request) {
    const path = request.url.replace('/api/v1/ai', '');
    return this.proxyService.forward(ServiceName.FEEDBACK, request, path);
  }

  @All('admin/*')
  @Roles(UserRole.ADMIN)
  handleAdmin(@Req() request: Request) {
    return this.proxyService.forward(ServiceName.USER, request, request.url);
  }
}
