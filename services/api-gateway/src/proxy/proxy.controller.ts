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
    const path = '/api/v1/auth/me' + request.path.replace('/api/v1/users/me', '');
    return this.proxyService.forward(
      ServiceName.AUTH,
      request,
      path || '/api/v1/auth/me',
    );
  }

  // ===== Document Management Endpoints =====
  
  /** List documents with pagination, search, and filters */
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

  /** Upload new document (ADMIN only) */
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

  /** Confirm document metadata after upload (ADMIN only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('documents/:documentId/confirm')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  handleDocumentConfirm(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.KNOWLEDGE,
      request,
      downstreamDocumentsPath(request),
    );
  }

  /** Document CRUD operations (get detail, delete, etc.) */
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

  // ===== Categories Endpoints =====

  /** Get all categories (active only, no auth required for public use) */
  @Get('categories/active')
  handlePublicCategories(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/categories/active',
    );
  }

  /** Get category tree (hierarchical structure) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('categories/active/tree')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleCategoriesActiveTree(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/categories/active/tree',
    );
  }

  /** Get category children by parent ID */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('categories/active/children')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleCategoriesActiveChildren(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/categories/active/children' + (request.url.includes('?') ? request.url.substring(request.url.indexOf('?')) : ''),
    );
  }

  /** Admin category management endpoints */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('categories')
  @Roles(UserRole.ADMIN)
  handleCategoriesAdmin(@Req() request: Request) {
    const relative = request.path.replace(/^\/api\/v1\/categories/, '') || '/';
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/categories' + (relative === '/' ? '' : relative),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('categories/*path')
  @Roles(UserRole.ADMIN)
  handleCategoriesAdminNested(@Req() request: Request) {
    const relative = request.path.replace(/^\/api\/v1\/categories/, '') || '/';
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/categories' + (relative === '/' ? '' : relative),
    );
  }

  // ===== Tags Endpoints =====

  /** Get all tags */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('tags')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleTagsGet(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/tags',
    );
  }

  /** Get popular tags */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('tags/popular')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleTagsPopular(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/tags/popular',
    );
  }

  /** Search tags */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('tags/search')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleTagsSearch(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/tags/search' + (request.url.includes('?') ? request.url.substring(request.url.indexOf('?')) : ''),
    );
  }

  /** Resolve tags (find-or-create) - ADMIN/MANAGER only */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('tags/resolve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  handleTagsResolve(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/tags/resolve',
    );
  }

  /** Tag CRUD operations (ADMIN only for create/update/delete) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('tags')
  @Roles(UserRole.ADMIN)
  handleTagsAdmin(@Req() request: Request) {
    const relative = request.path.replace(/^\/api\/v1\/tags/, '') || '/';
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/tags' + (relative === '/' ? '' : relative),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('tags/*path')
  @Roles(UserRole.ADMIN)
  handleTagsAdminNested(@Req() request: Request) {
    const relative = request.path.replace(/^\/api\/v1\/tags/, '') || '/';
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/tags' + (relative === '/' ? '' : relative),
    );
  }

  // ===== Metadata Endpoints =====

  /** Document metadata CRUD - ADMIN only */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('metadata')
  @Roles(UserRole.ADMIN)
  handleMetadataRoot(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/metadata',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('metadata/*path')
  @Roles(UserRole.ADMIN)
  handleMetadata(@Req() request: Request) {
    const relative = request.path.replace(/^\/api\/v1\/metadata/, '') || '/';
    const downstream = `/api/v1/metadata${relative === '/' ? '' : relative}`;
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      downstream,
    );
  }

  // ===== Access Rules Endpoints =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('access-rules')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAccessRulesRoot(@Req() request: Request) {
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/access-rules' + (request.url.includes('?') ? request.url.substring(request.url.indexOf('?')) : ''),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @All('access-rules/*path')
  @Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  handleAccessRules(@Req() request: Request) {
    const relative = request.path.replace(/^\/api\/v1\/access-rules/, '') || '/';
    return this.proxyService.forward(
      ServiceName.METADATA,
      request,
      '/api/v1/access-rules' + (relative === '/' ? '' : relative) + (request.url.includes('?') && !request.url.includes(relative) ? request.url.substring(request.url.indexOf('?')) : ''),
    );
  }

  // ===== Feedback Endpoints =====
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

  // ===== Analytics Endpoints =====
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

  // Admin endpoints
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
