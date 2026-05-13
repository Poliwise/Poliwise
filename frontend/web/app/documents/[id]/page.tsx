'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Trash2,
  Clock,
  User,
  File,
  History,
  Shield,
  Tag,
  Eye,
  Loader2,
  AlertCircle,
  Edit,
  Upload,
  ChevronRight,
  ExternalLink,
  FileText,
} from 'lucide-react';
import {
  documentService,
  documentMetadataService,
  accessRuleService,
} from '@/services/document.service';
import { AccessRuleModal } from '@/components/documents/AccessRuleModal';
import type {
  DocumentDetail,
  DocumentVersion,
  AccessRule,
  AuditLog,
  DocumentMetadata,
} from '@/types/document';
import {
  formatFileSize,
  formatDate,
  getFileTypeConfig,
  getStatusConfig,
} from '@/types/document';
import { useAuthStore, useIsAdmin, useIsManager } from '@/store/auth-store';
import PreviewModal from '@/components/documents/PreviewModal';

type Tab = 'detail' | 'versions' | 'access' | 'simulation' | 'audit';

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user: authUser } = useAuthStore();
  const isAdmin = useIsAdmin();
  const documentId = params.id as string;

  // State
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [metadataMissing, setMetadataMissing] = useState(false);
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);

  // Simulation state
  const [simulationData, setSimulationData] = useState<{
    documentId: string;
    metadataId: string;
    totalCompanyUsers: number;
    usersWithAccess: number;
    usersWithoutAccess: number;
    grantedUsers: Array<{
      userId: string;
      username: string;
      fullName: string | null;
      role: string | null;
      departmentId: string;
      departmentName: string;
      hasAccess: boolean;
      reason: string;
    }>;
    deniedUsers: Array<{
      userId: string;
      username: string;
      fullName: string | null;
      role: string | null;
      departmentId: string;
      departmentName: string;
      hasAccess: boolean;
      reason: string;
    }>;
  } | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('detail');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await documentService.getDocumentById(documentId);

      // Normalize document to ensure required fields exist (defensive coding)
      const normalizedDoc: DocumentDetail = {
        ...doc,
        versions: 'versions' in doc && Array.isArray((doc as any).versions)
          ? (doc as any).versions
          : [],
        tags: doc.tags || [],
      };
      setDocument(normalizedDoc);

      // Load metadata (gracefully handle 404 if metadata not created yet)
      try {
        const meta = await documentMetadataService.getMetadataByDocumentId(documentId);
        setMetadata(meta);
        setMetadataMissing(false);
      } catch (err: any) {
        const errStatus = err?.status || err?.statusCode || (err?.response?.status);
        if (errStatus === 404) {
          console.log('No metadata found for document (upload not confirmed yet)');
          setMetadataMissing(true);
        } else {
          console.error('Failed to load metadata:', err);
        }
      }

      // Load access rules by document ID
      try {
        const rules = await accessRuleService.getRulesByDocumentId(documentId);
        setAccessRules(rules);
      } catch (err) {
        console.error('Failed to load access rules:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (page = 1) => {
    try {
      const response = await documentService.getAuditLogs(documentId, { page, limit: 20 });
      setAuditLogs(response.data || []);
      setAuditTotalPages(response.totalPages);
      setAuditPage(page);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const loadSimulation = async () => {
    setSimulationLoading(true);
    setSimulationError(null);
    try {
      const result = await accessRuleService.simulateAccess(documentId);
      setSimulationData({
        ...result,
        grantedUsers: result.grantedUsers.map(u => ({ ...u })),
        deniedUsers: result.deniedUsers.map(u => ({ ...u })),
      });
    } catch (err: any) {
      setSimulationError(err?.message || err?.response?.data?.message || 'Không thể mô phỏng quyền truy cập');
    } finally {
      setSimulationLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'simulation') {
      loadSimulation();
    }
  }, [activeTab]);

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      await documentService.deleteDocument(documentId);
      router.push('/documents');
    } catch (err: any) {
      alert(err.message || 'Xóa thất bại');
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    try {
      await documentService.downloadDocument(documentId, document.originalFilename);
    } catch (err: any) {
      alert(err.message || 'Tải xuống thất bại');
    }
  };

  const handlePreview = () => setPreviewOpen(true);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Lỗi</h3>
              <p className="mt-1 text-sm text-red-600">{error || 'Không tìm thấy tài liệu'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fileConfig = getFileTypeConfig(document.fileType as unknown as string);
  const statusConfig = getStatusConfig(document.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-3xl mr-3">{fileConfig.icon}</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {document.title || document.originalFilename}
                </h1>
                <p className="text-sm text-gray-500">{document.originalFilename}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(() => {
                const ft = (document.fileType as unknown as string) || '';
                return ['PDF', 'DOCX', 'DOC'].includes(ft.toUpperCase());
              })() && (
                <button
                  onClick={handlePreview}
                  className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-lg text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Xem trước
                </button>
              )}
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Tải xuống
              </button>
              {isAdmin && (
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex space-x-8 border-b border-gray-200">
            {[
              { id: 'detail', label: 'Chi tiết', icon: Eye },
              { id: 'versions', label: 'Phiên bản', icon: History },
              { id: 'access', label: 'Phân quyền', icon: Shield },
              { id: 'simulation', label: 'Mô phỏng', icon: Shield },
              { id: 'audit', label: 'Nhật ký', icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center pb-3 px-1 border-b-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Detail Tab */}
        {activeTab === 'detail' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Thông tin tài liệu</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Loại file</dt>
                    <dd className="mt-1 text-sm text-gray-900">{fileConfig.label}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Kích thước</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatFileSize(document.fileSizeBytes || document.fileSize || 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phiên bản hiện tại</dt>
                    <dd className="mt-1 text-sm text-gray-900">v{document.currentVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Trạng thái</dt>
                    <dd className="mt-1">
                      <span
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${statusConfig.color}20`, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                    </dd>
                  </div>
                  {document.pageCount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Số trang</dt>
                      <dd className="mt-1 text-sm text-gray-900">{document.pageCount}</dd>
                    </div>
                  )}
                  {document.wordCount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Số từ</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {document.wordCount.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Ngôn ngữ</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {document.language === 'vi' ? 'Tiếng Việt' : document.language}
                    </dd>
                  </div>
                  {document.ocrRequired && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">OCR</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        Cần xử lý OCR
                        {document.ocrConfidence && (
                          <span className="ml-2 text-gray-500">
                            (Độ tin cậy: {(document.ocrConfidence * 100).toFixed(0)}%)
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {metadata && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Metadata</h2>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Mô tả</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {(metadata as any).description || 'Không có'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Thông tin hệ thống</h2>
                <dl className="space-y-3">
                  <div className="flex items-start">
                    <User className="w-4 h-4 text-gray-400 mt-0.5 mr-2" />
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Người tải lên</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        {document.uploadedByName || document.uploadedBy || 'Không xác định'}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 mr-2" />
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Ngày tạo</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        {formatDate(document.createdAt)}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 mr-2" />
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Cập nhật lần cuối</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">
                        {formatDate(document.updatedAt)}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              {document.tags && document.tags.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    Tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {document.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Lịch sử phiên bản</h2>
                {isAdmin && (
                  <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    <Upload className="w-4 h-4 mr-1.5" />
                    Tải lên phiên bản mới
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {(document.versions || []).map((version, index) => (
                <div key={version.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      v{version.versionNumber || version.version}
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">
                        {version.changelog || version.changesDescription || `Phiên bản ${version.versionNumber || version.version}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate((version.createdAt || version.uploadedAt || ''))} •{' '}
                        {formatFileSize(version.fileSizeBytes || version.fileSize || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {version.versionNumber === document.currentVersion && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        Hiện tại
                      </span>
                    )}
                    <button
                      onClick={() => documentService.downloadVersion(documentId, version.versionNumber || version.version!, document.originalFilename)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Tải xuống"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(document.versions || []).length === 0 && (
                <div className="p-8 text-center text-gray-500">Chưa có phiên bản nào</div>
              )}
            </div>
          </div>
        )}

        {/* Access Tab */}
        {activeTab === 'access' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Quy tắc truy cập</h2>
              {metadataMissing && (
                <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                  Metadata chưa tồn tại
                </span>
              )}
            </div>
            <div className="p-6">
              {metadataMissing ? (
                <div className="text-center text-gray-500 py-8">
                  <Shield className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
                  <p className="font-medium text-yellow-700">Tài liệu chưa có metadata</p>
                  <p className="text-sm mt-1">Metadata của tài liệu chưa được tạo. Vui lòng xác nhận metadata trước khi thiết lập quyền truy cập.</p>
                </div>
              ) : accessRules.length > 0 ? (
                <div className="space-y-3">
                  {accessRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {rule.targetType === 'ROLE' && `Vai trò: ${rule.targetRole}`}
                            {rule.targetType === 'DEPARTMENT' && `Phòng ban: ${rule.targetDepartmentName || rule.targetDepartmentId}`}
                            {rule.targetType === 'USER' && `Người dùng: ${rule.targetUserName || rule.targetUserId}`}
                          </p>
                          <p className="text-xs text-gray-500">{rule.targetType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            rule.permission === 'VIEW'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {rule.permission === 'VIEW' ? 'Cho phép' : 'Từ chối'}
                        </span>
                        {isAdmin && (
                          <>
                            <AccessRuleModal
                              documentId={documentId}
                              editingRule={rule}
                              onSuccess={async () => {
                                const rules = await accessRuleService.getRulesByDocumentId(documentId);
                                setAccessRules(rules);
                              }}
                            />
                            <button
                              onClick={async () => {
                                if (!confirm('Xóa quy tắc này?')) return;
                                try {
                                  await accessRuleService.deleteRule(rule.id);
                                  const rules = await accessRuleService.getRulesByDocumentId(documentId);
                                  setAccessRules(rules);
                                } catch {
                                  alert('Xóa thất bại');
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Xóa quy tắc"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Chưa có quy tắc truy cập nào</p>
                  <p className="text-sm">Tài liệu này có thể được truy cập công khai</p>
                </div>
              )}
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <AccessRuleModal
                    documentId={documentId}
                    onSuccess={async () => {
                      // Reload both metadata (in case it was auto-created) and access rules
                      try {
                        const meta = await documentMetadataService.getMetadataByDocumentId(documentId);
                        setMetadata(meta);
                        setMetadataMissing(false);
                      } catch (err: any) {
                        const errStatus = err?.status || err?.statusCode || (err?.response?.status);
                        if (errStatus === 404) {
                          setMetadataMissing(true);
                        }
                      }
                      const rules = await accessRuleService.getRulesByDocumentId(documentId);
                      setAccessRules(rules);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Simulation Tab */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            {simulationData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <p className="text-sm text-gray-500">Tổng nhân viên</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{simulationData.totalCompanyUsers}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <p className="text-sm text-gray-500">Được phép truy cập</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{simulationData.usersWithAccess}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <p className="text-sm text-gray-500">Không được phép</p>
                  <p className="text-3xl font-bold text-red-500 mt-1">{simulationData.usersWithoutAccess}</p>
                </div>
              </div>
            )}

            {simulationLoading ? (
              <div className="bg-white rounded-lg shadow p-12 flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                <p className="text-gray-500">Đang mô phỏng quyền truy cập...</p>
              </div>
            ) : simulationError ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">Lỗi mô phỏng</p>
                    <p className="text-sm text-red-600 mt-1">{simulationError}</p>
                  </div>
                </div>
              </div>
            ) : simulationData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Granted Users */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                      Được phép truy cập ({simulationData.grantedUsers.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {simulationData.grantedUsers.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        Không có ai được phép truy cập
                      </div>
                    ) : (
                      simulationData.grantedUsers.map((user) => (
                        <div key={user.userId} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-sm font-medium mr-3">
                              {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {user.fullName || user.username}
                              </p>
                              <p className="text-xs text-gray-500">
                                {user.role && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                                    user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                    user.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {user.role}
                                  </span>
                                )}
                                <span className="text-gray-400">•</span>
                                <span className="ml-2">{user.departmentName}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            {user.reason}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Denied Users */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                      Không được phép ({simulationData.deniedUsers.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {simulationData.deniedUsers.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        Tất cả đều được phép truy cập
                      </div>
                    ) : (
                      simulationData.deniedUsers.map((user) => (
                        <div key={user.userId} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-700 text-sm font-medium mr-3">
                              {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {user.fullName || user.username}
                              </p>
                              <p className="text-xs text-gray-500">
                                {user.role && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                                    user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                    user.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {user.role}
                                  </span>
                                )}
                                <span className="text-gray-400">•</span>
                                <span className="ml-2">{user.departmentName}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                            {user.reason}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 flex flex-col items-center">
                <Shield className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">Nhấn nút bên dưới để xem ai có quyền truy cập tài liệu này</p>
                <button
                  onClick={loadSimulation}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Mô phỏng quyền truy cập
                </button>
              </div>
            )}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Nhật ký hoạt động</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-start">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-sm">
                    {log.action.charAt(0)}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-gray-500">
                      {log.actorUsername || log.actorId} • {formatDate(log.createdAt)}
                    </p>
                    {log.ipAddress && (
                      <p className="text-xs text-gray-400">IP: {log.ipAddress}</p>
                    )}
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="p-8 text-center text-gray-500">Chưa có nhật ký nào</div>
              )}
            </div>
            {auditTotalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-500">Trang {auditPage} / {auditTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadAuditLogs(auditPage - 1)}
                    disabled={auditPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => loadAuditLogs(auditPage + 1)}
                    disabled={auditPage === auditTotalPages}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {document && (
        <PreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          documentId={documentId}
          filename={document.originalFilename || document.fileName || 'document'}
          fileType={(document.fileType as unknown as string) || 'UNKNOWN'}
          getPreviewUrl={documentService.getPreviewUrl}
        />
      )}
    </div>
  );
}
