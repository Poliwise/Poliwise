import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  All,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProxyService, ServiceName } from './proxy.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, Public } from '../common/decorators';
import { UserRole } from '../common/interfaces';

@Controller('api/v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  // ===== Auth Endpoints =====
  // POST /api/v1/auth/login - Public endpoint
  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  handleAuthLogin(@Req() request: Request) {
    const path = request.url.replace('/api/v1/auth', '');
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  // POST /api/v1/auth/register - Public endpoint
  @Public()
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  handleAuthRegister(@Req() request: Request) {
    const path = request.url.replace('/api/v1/auth', '');
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  // POST /api/v1/auth/refresh - Public endpoint (token refresh)
  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  handleAuthRefresh(@Req() request: Request) {
    const path = request.url.replace('/api/v1/auth', '');
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  // POST /api/v1/auth/logout - Authenticated endpoint
  @UseGuards(JwtAuthGuard)
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAuthLogout(@Req() request: Request) {
    const path = request.url.replace('/api/v1/auth', '');
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  // POST /api/v1/auth/logout-all - Authenticated endpoint
  @UseGuards(JwtAuthGuard)
  @Post('auth/logout-all')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAuthLogoutAll(@Req() request: Request) {
    const path = request.url.replace('/api/v1/auth', '');
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  // GET /api/v1/auth/sessions - Authenticated endpoint
  @UseGuards(JwtAuthGuard)
  @Get('auth/sessions')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAuthSessions(@Req() request: Request) {
    const path = request.url.replace('/api/v1/auth', '');
    return this.proxyService.forward(ServiceName.AUTH, request, path);
  }

  // ===== User Endpoints =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('users/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleUsers(@Req() request: Request) {
    const path = request.url.replace('/api/v1/users', '');
    return this.proxyService.forward(ServiceName.USER, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('documents/*')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleDocuments(@Req() request: Request) {
    const path = request.url.replace('/api/v1/documents', '');
    return this.proxyService.forward(ServiceName.KNOWLEDGE, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('documents/upload')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  handleDocumentUpload(@Req() request: Request) {
    const path = request.url.replace('/api/v1/documents', '');
    return this.proxyService.forward(ServiceName.KNOWLEDGE, request, path);
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
