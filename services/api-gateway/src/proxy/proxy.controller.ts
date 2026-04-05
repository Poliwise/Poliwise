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

/** Path + query: dùng request.path (không gồm ?) để ghép URL downstream đúng. */
function downstreamDocumentsPath(request: Request): string {
  const relative = request.path.replace(/^\/api\/v1\/documents/, '') || '/';
  return '/api/v1/documents' + (relative === '/' ? '' : relative);
}

@Controller('api/v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  // ===== User Endpoints =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('users/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleUsers(@Req() request: Request) {
    const path = request.url.replace('/api/v1/users', '');
    return this.proxyService.forward(ServiceName.USER, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('documents')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleDocumentsRoot(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.KNOWLEDGE,
      request,
      downstreamDocumentsPath(request),
    );
  }

  /** Đăng ký trước `documents/*` để POST upload chỉ áp dụng role ADMIN. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('documents/upload')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  handleDocumentUpload(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.KNOWLEDGE,
      request,
      downstreamDocumentsPath(request),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('documents/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleDocumentsNested(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.KNOWLEDGE,
      request,
      downstreamDocumentsPath(request),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('metadata/*')
  @Roles(UserRole.ADMIN)
  handleMetadata(@Req() request: Request) {
    const path = request.url.replace('/api/v1/metadata', '');
    return this.proxyService.forward(ServiceName.METADATA, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('feedback/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleFeedback(@Req() request: Request) {
    const path = request.url.replace('/api/v1/feedback', '');
    return this.proxyService.forward(ServiceName.FEEDBACK, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('analytics/*')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  handleAnalytics(@Req() request: Request) {
    const path = request.url.replace('/api/v1/analytics', '');
    return this.proxyService.forward(ServiceName.FEEDBACK, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('ai/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAI(@Req() request: Request) {
    const path = request.url.replace('/api/v1/ai', '');
    return this.proxyService.forward(ServiceName.FEEDBACK, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('admin/*')
  @Roles(UserRole.ADMIN)
  handleAdmin(@Req() request: Request) {
    return this.proxyService.forward(ServiceName.USER, request, request.url);
  }
}
