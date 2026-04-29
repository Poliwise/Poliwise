import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
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

/** Tách prefix gateway, giữ nguyên /api/v1/service-prefix/... cho downstream. */
function downstreamPath(request: Request, prefix: string): string {
  const relative = request.path.replace(new RegExp(`^${prefix}`), '') || '/';
  return `${prefix}${relative === '/' ? '' : relative}`;
}

@Controller('api/v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  // ===== Department Management Endpoints (Admin only) =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('departments')
  @Roles(UserRole.ADMIN)
  handleDepartmentsRoot(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.USER,
      request,
      downstreamPath(request, '/api/v1/departments'),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('departments/*path')
  @Roles(UserRole.ADMIN)
  handleDepartmentsNested(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.USER,
      request,
      downstreamPath(request, '/api/v1/departments'),
    );
  }

  // ===== User Management Endpoints =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('users')
  @Roles(UserRole.ADMIN)
  handleUsersRoot(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.AUTH,
      request,
      downstreamPath(request, '/api/v1/users'),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('users/*path')
  @Roles(UserRole.ADMIN)
  handleUsers(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.AUTH,
      request,
      downstreamPath(request, '/api/v1/users'),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('users/me/*path')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleUserMe(@Req() request: Request) {
    // Route to auth-service /me endpoint (current user's profile)
    const path = '/api/v1/auth/me' + request.path.replace('/api/v1/users/me', '');
    return this.proxyService.forward(
      ServiceName.AUTH,
      request,
      path || '/api/v1/auth/me',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('documents')
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
  @All('documents/*path')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleDocumentsNested(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.KNOWLEDGE,
      request,
      downstreamDocumentsPath(request),
    );
  }

  /**
   * Public endpoint for fetching active categories (no auth required).
   * Used by the upload modal to populate the category dropdown.
   */
  @Get('categories/active')
  handlePublicCategories(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/categories/active',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('metadata/*path')
  @Roles(UserRole.ADMIN)
  handleMetadata(@Req() request: Request) {
    // Gateway path: /api/v1/metadata/categories/active
    // Metadata-service expects: /api/v1/categories/active
    // Strip "/api/v1/metadata" prefix and prepend "/api/v1"
    const relative = request.path.replace(/^\/api\/v1\/metadata/, '') || '/';
    const downstream = `/api/v1${relative === '/' ? '' : relative}`;
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      downstream,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('feedback/*path')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleFeedback(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.FEEDBACK,
      request,
      downstreamPath(request, '/api/v1/feedback'),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('analytics/*path')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  handleAnalytics(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.FEEDBACK,
      request,
      downstreamPath(request, '/api/v1/analytics'),
    );
  }

  // AI Q&A endpoints — route to ai-qa-service
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('ai/*path')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAI(@Req() request: Request) {
    const path = request.url.replace('/api/v1/ai', '');
    return this.proxyService.forward(ServiceName.AI_QA, request, path);
  }

  // Ingestion endpoints — route to ingestion-service
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('ingest')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  handleIngest(@Req() request: Request) {
    const path = request.url.replace('/api/v1', '');
    return this.proxyService.forward(ServiceName.INGESTION, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('ingest/:jobId/status')
  @Roles(UserRole.ADMIN)
  handleIngestStatus(@Req() request: Request) {
    const path = request.url.replace('/api/v1', '');
    return this.proxyService.forward(ServiceName.INGESTION, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('ingest/:docId/reindex')
  @Roles(UserRole.ADMIN)
  handleReindex(@Req() request: Request) {
    const path = request.url.replace('/api/v1', '');
    return this.proxyService.forward(ServiceName.INGESTION, request, path);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('admin/*path')
  @Roles(UserRole.ADMIN)
  handleAdmin(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.USER,
      request,
      downstreamPath(request, '/api/v1/admin'),
    );
  }
}
