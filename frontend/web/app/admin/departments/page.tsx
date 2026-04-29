'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layout';
import { PageHeader, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import { useRouter } from 'next/navigation';
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest } from '@/types';
import styles from './departments.module.css';

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  parentId: string;
}

const initialFormData: DepartmentFormData = {
  name: '',
  code: '',
  description: '',
  parentId: '',
};

export default function DepartmentsPage() {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>(initialFormData);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Department users
  const [deptUsers, setDeptUsers] = useState<any[]>([]);
  const [deptUsersLoading, setDeptUsersLoading] = useState(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.departments.getAll({
        page: page - 1,
        limit: 12,
        sortBy: 'name',
        sortDir: 'ASC',
      });
      setDepartments(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadDepartments();
  }, [isAdmin, router, loadDepartments]);

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(search.toLowerCase()) ||
    dept.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setFormError('');
    setFormLoading(true);
    try {
      await api.departments.create({
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
      } as CreateDepartmentRequest);
      setShowCreateModal(false);
      setFormData(initialFormData);
      loadDepartments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Tạo phòng ban thất bại';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedDepartment) return;
    setFormError('');
    setFormLoading(true);
    try {
      await api.departments.update(selectedDepartment.id, {
        name: formData.name || undefined,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
      } as UpdateDepartmentRequest);
      setShowEditModal(false);
      setSelectedDepartment(null);
      setFormData(initialFormData);
      loadDepartments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Cập nhật phòng ban thất bại';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDepartment) return;
    setFormLoading(true);
    try {
      await api.departments.delete(selectedDepartment.id);
      setShowDeleteModal(false);
      setSelectedDepartment(null);
      loadDepartments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xóa phòng ban thất bại';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      await api.departments.update(dept.id, { isActive: !dept.isActive });
      loadDepartments();
    } catch (err) {
      console.error('Failed to toggle department status:', err);
    }
  };

  const openEditModal = (dept: Department) => {
    setSelectedDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      parentId: dept.parent?.id || '',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (dept: Department) => {
    setSelectedDepartment(dept);
    setFormError('');
    setShowDeleteModal(true);
  };

  const openUsersModal = async (dept: Department) => {
    setSelectedDepartment(dept);
    setShowUsersModal(true);
    setDeptUsersLoading(true);
    try {
      const result = await api.departments.getUsers(dept.id, { page: 0, limit: 50 });
      setDeptUsers(result.data);
    } catch (err) {
      console.error('Failed to load department users:', err);
      setDeptUsers([]);
    } finally {
      setDeptUsersLoading(false);
    }
  };

  const toggleExpand = (deptId: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepts(newExpanded);
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Quản lý phòng ban</h1>
            <p>Quản lý cơ cấu tổ chức và phòng ban trong hệ thống</p>
          </div>
          <button
            className={styles.createButton}
            onClick={() => { setFormData(initialFormData); setFormError(''); setShowCreateModal(true); }}
          >
            <Plus size={16} />
            Tạo phòng ban
          </button>
        </div>

        <div className={styles.filters}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm kiếm phòng ban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loading}>
              <Loader2 size={32} className={styles.spinner} />
              <span>Đang tải...</span>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className={styles.empty}>
              <Building2 size={48} />
              <p>Không tìm thấy phòng ban nào</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredDepartments.map((dept) => (
                <Card key={dept.id} padding="md" className={`${styles.deptCard} ${!dept.isActive ? styles.inactive : ''}`}>
                  <div className={styles.deptIcon}>
                    <Building2 size={22} />
                  </div>
                  <div className={styles.deptInfo}>
                    <h3 className={styles.deptName}>{dept.name}</h3>
                    <code className={styles.deptCode}>{dept.code}</code>
                    {dept.description && (
                      <p className={styles.deptDesc}>{dept.description}</p>
                    )}
                  </div>
                  <div className={styles.deptStats}>
                    <div className={styles.statItem}>
                      <Users size={14} />
                      <span>{dept.userCount} nhân viên</span>
                    </div>
                    {dept.parent && (
                      <div className={styles.parentInfo}>
                        Thuộc: <strong>{dept.parent.name}</strong>
                      </div>
                    )}
                  </div>
                  <div className={styles.deptActions}>
                    <button
                      className={`${styles.actionButton} ${dept.isActive ? styles.success : styles.warning}`}
                      onClick={() => handleToggleActive(dept)}
                      title={dept.isActive ? 'Tắt hoạt động' : 'Bật hoạt động'}
                    >
                      {dept.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => openUsersModal(dept)}
                      title="Xem nhân viên"
                    >
                      <Users size={16} />
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => openEditModal(dept)}
                      title="Chỉnh sửa"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.danger}`}
                      onClick={() => openDeleteModal(dept)}
                      title="Xóa"
                      disabled={dept.userCount > 0}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>Trang {page} / {totalPages}</span>
            <button
              className={styles.pageButton}
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <DepartmentFormModal
            title="Tạo phòng ban mới"
            formData={formData}
            setFormData={setFormData}
            error={formError}
            loading={formLoading}
            departments={departments}
            onSubmit={handleCreate}
            onClose={() => setShowCreateModal(false)}
          />
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <DepartmentFormModal
            title="Chỉnh sửa phòng ban"
            formData={formData}
            setFormData={setFormData}
            error={formError}
            loading={formLoading}
            departments={departments}
            excludeId={selectedDepartment?.id}
            onSubmit={handleUpdate}
            onClose={() => setShowEditModal(false)}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>
                  <AlertCircle size={20} />
                  <h2>Xác nhận xóa phòng ban</h2>
                </div>
                <button className={styles.modalClose} onClick={() => setShowDeleteModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.modalBody}>
                {formError && (
                  <div className={styles.errorBanner}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}
                <p>Bạn có chắc chắn muốn xóa phòng ban <strong>{selectedDepartment?.name}</strong>?</p>
                <p className={styles.warning}>Hành động này sẽ vô hiệu hóa phòng ban (soft delete).</p>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelButton} onClick={() => setShowDeleteModal(false)}>
                  Hủy
                </button>
                <button className={styles.deleteButton} onClick={handleDelete} disabled={formLoading}>
                  {formLoading ? <Loader2 size={16} className={styles.spinner} /> : <Trash2 size={16} />}
                  Xóa phòng ban
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Modal */}
        {showUsersModal && (
          <div className={styles.modalOverlay} onClick={() => setShowUsersModal(false)}>
            <div className={`${styles.modal} ${styles.usersModal}`} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>
                  <Users size={20} />
                  <h2>Nhân viên phòng ban: {selectedDepartment?.name}</h2>
                </div>
                <button className={styles.modalClose} onClick={() => setShowUsersModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.modalBody}>
                {deptUsersLoading ? (
                  <div className={styles.loading}>
                    <Loader2 size={24} className={styles.spinner} />
                    <span>Đang tải...</span>
                  </div>
                ) : deptUsers.length === 0 ? (
                  <div className={styles.empty}>
                    <Users size={32} />
                    <p>Phòng ban này chưa có nhân viên</p>
                  </div>
                ) : (
                  <div className={styles.usersList}>
                    {deptUsers.map((user) => (
                      <div key={user.userId || user.id} className={styles.userItem}>
                        <div className={styles.userAvatar}>
                          {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.userInfo}>
                          <strong>{user.fullName || user.username}</strong>
                          <span>{user.email}</span>
                        </div>
                        <span className={styles.userRole}>{user.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelButton} onClick={() => setShowUsersModal(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// Department Form Modal Component
interface DepartmentFormModalProps {
  title: string;
  formData: DepartmentFormData;
  setFormData: (data: DepartmentFormData) => void;
  error: string;
  loading: boolean;
  departments: Department[];
  excludeId?: string;
  onSubmit: () => void;
  onClose: () => void;
}

function DepartmentFormModal({
  title,
  formData,
  setFormData,
  error,
  loading,
  departments,
  excludeId,
  onSubmit,
  onClose,
}: DepartmentFormModalProps) {
  const parentDepts = departments.filter(d => d.id !== excludeId);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Building2 size={20} />
            <h2>{title}</h2>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className={styles.modalBody}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Tên phòng ban *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ví dụ: Phòng Kỹ thuật"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Mã phòng ban *</label>
              <input
                type="text"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ví dụ: ENG, HR, IT"
                required
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label>Mô tả</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả về phòng ban..."
                rows={3}
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label>Phòng ban cha</label>
              <select
                value={formData.parentId}
                onChange={e => setFormData({ ...formData, parentId: e.target.value })}
              >
                <option value="">-- Không có --</option>
                {parentDepts.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className={styles.submitButton} disabled={loading || !formData.name || !formData.code}>
              {loading ? <Loader2 size={16} className={styles.spinner} /> : <CheckCircle size={16} />}
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
