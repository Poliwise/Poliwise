'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Shield,
  UserX,
  UserCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserPlus,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  Filter,
  Building2,
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import { UserRole, AccountStatus } from '@/types';
import type { User, Department } from '@/types';
import styles from './admin-users.module.css';

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.MANAGER]: 'Quản lý',
  [UserRole.USER]: 'Người dùng',
};

const statusLabels: Record<AccountStatus, string> = {
  [AccountStatus.ACTIVE]: 'Hoạt động',
  [AccountStatus.DEACTIVATED]: 'Vô hiệu hóa',
  [AccountStatus.REVOKED]: 'Thu hồi',
};

const statusBadgeClass: Record<AccountStatus, string> = {
  [AccountStatus.ACTIVE]: styles.statusActive,
  [AccountStatus.DEACTIVATED]: styles.statusDeactivated,
  [AccountStatus.REVOKED]: styles.statusRevoked,
};

export default function AdminUsersPage() {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter states
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.users.search({
        page: page - 1,
        limit: 10,
        search: search || undefined,
        role: filterRole || undefined,
        status: filterStatus || undefined,
        departmentId: filterDepartment || undefined,
      });
      setUsers(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterRole, filterStatus, filterDepartment]);

  const loadDepartments = useCallback(async () => {
    try {
      const depts = await api.departments.getActive();
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadDepartments();
    loadUsers();
  }, [isAdmin, router, loadUsers, loadDepartments]);

  const handleStatusChange = async (userId: string, status: AccountStatus) => {
    try {
      if (status === AccountStatus.DEACTIVATED) {
        await api.users.deactivate(userId);
      } else if (status === AccountStatus.ACTIVE) {
        await api.users.reactivate(userId);
      } else if (status === AccountStatus.REVOKED) {
        await api.users.revoke(userId);
      }
      loadUsers();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    try {
      await api.users.delete(userId);
      loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const openDetailModal = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const clearFilters = () => {
    setFilterRole('');
    setFilterStatus('');
    setFilterDepartment('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = filterRole || filterStatus || filterDepartment || search;

  return (
    <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Quản lý người dùng</h1>
            <p>Quản lý tài khoản, phân quyền và trạng thái người dùng</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.createBulkButton}
              onClick={() => { setActiveTab('bulk'); setShowBulkModal(true); }}
            >
              <Upload size={16} />
              Tạo hàng loạt
            </button>
            <button
              className={styles.createButton}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} />
              Tạo người dùng
            </button>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterRow}>
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, email, username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              />
            </div>
            <button
              className={`${styles.filterToggleBtn} ${showFilters ? styles.active : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              Bộ lọc
              {hasActiveFilters && <span className={styles.filterBadge} />}
            </button>
          </div>

          {showFilters && (
            <div className={styles.filterPanel}>
              <div className={styles.filterGroup}>
                <label>Vai trò</label>
                <select
                  value={filterRole}
                  onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                >
                  <option value="">Tất cả vai trò</option>
                  <option value="USER">Người dùng</option>
                  <option value="MANAGER">Quản lý</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Trạng thái</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="DEACTIVATED">Vô hiệu hóa</option>
                  <option value="REVOKED">Thu hồi</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Phòng ban</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => { setFilterDepartment(e.target.value); setPage(1); }}
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterActions}>
                <button className={styles.applyBtn} onClick={loadUsers}>
                  Áp dụng
                </button>
                {hasActiveFilters && (
                  <button className={styles.clearBtn} onClick={clearFilters}>
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <div className={styles.activeFilters}>
              {filterRole && <span className={styles.filterChip}>Vai trò: {roleLabels[filterRole as UserRole]}</span>}
              {filterStatus && <span className={styles.filterChip}>Trạng thái: {statusLabels[filterStatus as AccountStatus]}</span>}
              {filterDepartment && <span className={styles.filterChip}>Phòng ban: {departments.find(d => d.id === filterDepartment)?.name}</span>}
              {search && <span className={styles.filterChip}>Tìm: "{search}"</span>}
            </div>
          )}
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loading}>
              <Loader2 size={32} className={styles.spinner} />
              <span>Đang tải...</span>
            </div>
          ) : users.length === 0 ? (
            <div className={styles.empty}>
              <UserIcon size={48} />
              <p>Không tìm thấy người dùng nào</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Phòng ban</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.username}>{user.username}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${user.role === UserRole.ADMIN ? styles.roleAdmin : user.role === UserRole.MANAGER ? styles.roleManager : styles.roleUser}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td>
                      {user.department?.name ? (
                        <div className={styles.deptCell}>
                          <Building2 size={14} />
                          <span>{user.department.name}</span>
                        </div>
                      ) : <span className={styles.noData}>-</span>}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${statusBadgeClass[user.status]}`}>
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionButton}
                          onClick={() => openDetailModal(user)}
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={() => openEditModal(user)}
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        {user.status === AccountStatus.ACTIVE && (
                          <>
                            <button
                              className={styles.actionButton}
                              onClick={() => handleStatusChange(user.id, AccountStatus.DEACTIVATED)}
                              title="Vô hiệu hóa"
                            >
                              <UserX size={16} />
                            </button>
                            <button
                              className={`${styles.actionButton} ${styles.danger}`}
                              onClick={() => openDeleteModal(user)}
                              title="Xóa"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {(user.status === AccountStatus.DEACTIVATED || user.status === AccountStatus.REVOKED) && (
                          <button
                            className={`${styles.actionButton} ${styles.success}`}
                            onClick={() => handleStatusChange(user.id, AccountStatus.ACTIVE)}
                            title="Kích hoạt lại"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Hiển thị {users.length} / {total} người dùng
            </span>
            <div className={styles.paginationControls}>
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
          </div>
        )}

        {/* User Detail Modal */}
        {showDetailModal && selectedUser && (
          <UserDetailModal
            user={selectedUser}
            departments={departments}
            onClose={() => { setShowDetailModal(false); setSelectedUser(null); }}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <UserEditModal
            user={selectedUser}
            departments={departments}
            onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
            onSuccess={() => { setShowEditModal(false); setSelectedUser(null); loadUsers(); }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedUser && (
          <UserDeleteModal
            user={selectedUser}
            onClose={() => { setShowDeleteModal(false); setSelectedUser(null); }}
            onConfirm={() => { handleDelete(selectedUser.id); setShowDeleteModal(false); setSelectedUser(null); }}
          />
        )}

        {/* Create Single User Modal */}
        {showCreateModal && (
          <CreateUserModal
            departments={departments}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => { setShowCreateModal(false); loadUsers(); }}
          />
        )}

        {/* Bulk Create Modal */}
        {showBulkModal && (
          <BulkCreateModal
            departments={departments}
            onClose={() => setShowBulkModal(false)}
            onSuccess={() => { setShowBulkModal(false); loadUsers(); }}
          />
        )}
      </div>
  );
}

// ===============================
// User Detail Modal
// ===============================
interface UserDetailModalProps {
  user: User;
  departments: Department[];
  onClose: () => void;
  onStatusChange: (userId: string, status: AccountStatus) => void;
}

function UserDetailModal({ user, departments, onClose, onStatusChange }: UserDetailModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.detailModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <UserIcon size={20} />
            <h2>Chi tiết người dùng</h2>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.detailHeader}>
            <div className={styles.detailAvatar}>
              {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className={styles.detailHeaderInfo}>
              <h3>{user.fullName || user.username}</h3>
              <span className={`${styles.statusBadge} ${statusBadgeClass[user.status]}`}>
                {statusLabels[user.status]}
              </span>
            </div>
          </div>

          <div className={styles.detailSections}>
            <div className={styles.detailSection}>
              <h4>Thông tin tài khoản</h4>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <UserIcon size={14} />
                  <label>Tên đăng nhập:</label>
                  <span>{user.username}</span>
                </div>
                <div className={styles.detailItem}>
                  <Mail size={14} />
                  <label>Email:</label>
                  <span>{user.email}</span>
                </div>
                <div className={styles.detailItem}>
                  <Shield size={14} />
                  <label>Vai trò:</label>
                  <span className={`${styles.roleBadge} ${user.role === UserRole.ADMIN ? styles.roleAdmin : user.role === UserRole.MANAGER ? styles.roleManager : styles.roleUser}`}>
                    {roleLabels[user.role]}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <Building2 size={14} />
                  <label>Phòng ban:</label>
                  <span>{user.department?.name || 'Chưa phân công'}</span>
                </div>
              </div>
            </div>

            {user.createdAt && (
              <div className={styles.detailSection}>
                <h4>Thông tin hệ thống</h4>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <Calendar size={14} />
                    <label>Ngày tạo:</label>
                    <span>{new Date(user.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <Calendar size={14} />
                    <label>Cập nhật cuối:</label>
                    <span>{new Date(user.updatedAt || user.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          {user.status === AccountStatus.ACTIVE && (
            <>
              <button
                className={styles.warningButton}
                onClick={() => onStatusChange(user.id, AccountStatus.DEACTIVATED)}
              >
                <UserX size={16} />
                Vô hiệu hóa
              </button>
              <button
                className={styles.dangerButton}
                onClick={() => onStatusChange(user.id, AccountStatus.REVOKED)}
              >
                <Shield size={16} />
                Thu hồi tài khoản
              </button>
            </>
          )}
          {(user.status === AccountStatus.DEACTIVATED || user.status === AccountStatus.REVOKED) && (
            <button
              className={styles.successButton}
              onClick={() => onStatusChange(user.id, AccountStatus.ACTIVE)}
            >
              <UserCheck size={16} />
              Kích hoạt lại
            </button>
          )}
          <button className={styles.cancelButton} onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ===============================
// User Edit Modal
// ===============================
interface UserEditModalProps {
  user: User;
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

function UserEditModal({ user, departments, onClose, onSuccess }: UserEditModalProps) {
  const [form, setForm] = useState({
    role: user.role,
    status: user.status,
    departmentId: user.departmentId || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.id) {
      setError('Lỗi: Không tìm thấy ID người dùng');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.users.update(user.id, {
        role: form.role,
        status: form.status,
        departmentId: form.departmentId || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Cập nhật thất bại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Edit2 size={20} />
            <h2>Chỉnh sửa người dùng</h2>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.userInfoHeader}>
            <div className={styles.avatar}>
              {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user.fullName || user.username}</strong>
              <p>{user.email}</p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Vai trò</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              >
                <option value={UserRole.USER}>Người dùng</option>
                <option value={UserRole.MANAGER}>Quản lý</option>
                <option value={UserRole.ADMIN}>Quản trị viên</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Phòng ban</label>
              <select
                value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
              >
                <option value="">-- Chưa phân công --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Hủy</button>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? <Loader2 size={16} className={styles.spinner} /> : <CheckCircle size={16} />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===============================
// User Delete Modal
// ===============================
interface UserDeleteModalProps {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
}

function UserDeleteModal({ user, onClose, onConfirm }: UserDeleteModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <AlertCircle size={20} />
            <h2>Xác nhận xóa người dùng</h2>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.warningBox}>
            <p>Bạn có chắc chắn muốn <strong>xóa mềm</strong> người dùng <strong>{user.username}</strong>?</p>
            <ul>
              <li>Tài khoản sẽ bị vô hiệu hóa vĩnh viễn</li>
              <li>Tất cả phiên đăng nhập sẽ bị thu hồi</li>
              <li>Thông tin cá nhân sẽ được ẩn danh (anonymized)</li>
              <li>Email thông báo sẽ được gửi cho người dùng</li>
            </ul>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>Hủy</button>
          <button className={styles.dangerButton} onClick={onConfirm}>
            <Trash2 size={16} />
            Xóa người dùng
          </button>
        </div>
      </div>
    </div>
  );
}

// ===============================
// Create User Modal
// ===============================
interface CreateUserModalProps {
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

function CreateUserModal({ departments, onClose, onSuccess }: CreateUserModalProps) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    role: UserRole.USER,
    departmentId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.users.create({
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        role: form.role,
        departmentId: form.departmentId || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Tạo người dùng thất bại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <UserPlus size={20} />
            <h2>Tạo người dùng mới</h2>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {error && (
            <div className={error.includes('email thất bại') ? styles.warningBanner : styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Tên đăng nhập *</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="nguyen.van.a"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Họ và tên *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Nguyễn Văn A"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="nguyen.van.a@company.com"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Vai trò *</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              >
                <option value={UserRole.USER}>Người dùng</option>
                <option value={UserRole.MANAGER}>Quản lý</option>
                <option value={UserRole.ADMIN}>Quản trị viên</option>
              </select>
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label>Phòng ban</label>
              <select
                value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
              >
                <option value="">-- Chưa phân công --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Hủy</button>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? <Loader2 size={16} className={styles.spinner} /> : <CheckCircle size={16} />}
              Tạo người dùng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===============================
// Bulk Create Modal
// ===============================
interface BulkCreateModalProps {
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

function BulkCreateModal({ departments, onClose, onSuccess }: BulkCreateModalProps) {
  const [users, setUsers] = useState<Array<{
    username: string;
    email: string;
    fullName: string;
    role: string;
    departmentId: string;
    status: 'ok' | 'error';
    error?: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const parsed = lines.slice(1).map((line, idx) => {
        const vals = line.split(',').map(v => v.trim());
        const row: typeof users[0] = {
          username: vals[headers.indexOf('username')] || '',
          email: vals[headers.indexOf('email')] || '',
          fullName: vals[headers.indexOf('fullname')] || vals[headers.indexOf('name')] || '',
          role: vals[headers.indexOf('role')] || 'USER',
          departmentId: '',
          status: 'ok',
        };

        if (!row.username || !row.email) {
          row.status = 'error';
          row.error = 'Thiếu username hoặc email';
        }
        if (!row.email.includes('@')) {
          row.status = 'error';
          row.error = (row.error ? row.error + '; ' : '') + 'Email không hợp lệ';
        }
        return row;
      });

      setUsers(parsed);
    };
    reader.readAsText(file);
  };

  const addRow = () => {
    setUsers(u => [...u, { username: '', email: '', fullName: '', role: 'USER', departmentId: '', status: 'ok' }]);
  };

  const removeRow = (idx: number) => {
    setUsers(u => u.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: string, value: string) => {
    setUsers(u => u.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (users.length === 0) { setError('Danh sách người dùng trống'); return; }
    const validUsers = users.filter(u => u.status === 'ok');
    if (validUsers.length === 0) { setError('Không có người dùng hợp lệ để tạo'); return; }

    setError('');
    setLoading(true);
    try {
      const result = await api.users.bulkCreate(validUsers.map(u => ({
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        departmentId: u.departmentId || undefined,
      })));
      setSuccessCount(result.successCount || 0);
      if (result.successCount > 0) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Tạo hàng loạt thất bại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.bulkModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Upload size={20} />
            <h2>Tạo người dùng hàng loạt</h2>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {error && <div className={styles.errorBanner}><AlertCircle size={16} /><span>{error}</span></div>}
          {successCount > 0 && (
            <div className={styles.successBanner}>
              <CheckCircle size={16} />
              <span>Đã tạo thành công {successCount} người dùng!</span>
            </div>
          )}

          <div className={styles.bulkInfo}>
            <p>Tải lên file CSV hoặc thêm thủ công. Các cột: <code>username, email, fullname, role</code></p>
            <input type="file" accept=".csv" onChange={handleFileUpload} className={styles.fileInput} />
          </div>

          <div className={styles.bulkTableWrapper}>
            <table className={styles.bulkTable}>
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Email</th>
                  <th>Họ và tên</th>
                  <th>Vai trò</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((row, idx) => (
                  <tr key={idx} className={row.status === 'error' ? styles.errorRow : ''}>
                    <td><input type="text" value={row.username} onChange={e => updateRow(idx, 'username', e.target.value)} placeholder="username" className={styles.inlineInput} /></td>
                    <td><input type="email" value={row.email} onChange={e => updateRow(idx, 'email', e.target.value)} placeholder="email@company.com" className={styles.inlineInput} /></td>
                    <td><input type="text" value={row.fullName} onChange={e => updateRow(idx, 'fullName', e.target.value)} placeholder="Họ và tên" className={styles.inlineInput} /></td>
                    <td>
                      <select value={row.role} onChange={e => updateRow(idx, 'role', e.target.value)} className={styles.inlineSelect}>
                        <option value="USER">USER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td><button type="button" className={styles.removeRowBtn} onClick={() => removeRow(idx)}><X size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className={styles.emptyBulk}>
              <UserPlus size={32} />
              <p>Chưa có người dùng nào. Thêm thủ công hoặc tải file CSV.</p>
            </div>
          )}

          <div className={styles.bulkActions}>
            <button type="button" className={styles.addRowButton} onClick={addRow}><Plus size={14} /> Thêm dòng</button>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Đóng</button>
            <button type="submit" className={styles.submitButton} disabled={loading || users.length === 0}>
              {loading ? <Loader2 size={16} className={styles.spinner} /> : <CheckCircle size={16} />}
              Tạo {users.filter(u => u.status === 'ok').length} người dùng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
