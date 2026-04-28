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
} from 'lucide-react';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/store';
import { UserRole, AccountStatus } from '@/types';
import type { User } from '@/types';
import styles from './admin-users.module.css';

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.MANAGER]: 'Manager',
  [UserRole.USER]: 'User',
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

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.users.search({
        page,
        limit: 10,
        search: search || undefined,
      });
      setUsers(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadUsers();
  }, [isAdmin, loadUsers, router]);

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

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Quản lý người dùng</h1>
            <p>Quản lý tài khoản và phân quyền người dùng</p>
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
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm kiếm người dùng..."
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
                  <tr key={user.userId}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span>{user.username}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${user.role === UserRole.ADMIN ? styles.roleAdmin : user.role === UserRole.MANAGER ? styles.roleManager : styles.roleUser}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td>{user.departmentName || '-'}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${statusBadgeClass[user.status]}`}>
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {user.status === AccountStatus.ACTIVE && (
                          <>
                            <button
                              className={styles.actionButton}
                              onClick={() => handleStatusChange(user.userId, AccountStatus.DEACTIVATED)}
                              title="Vô hiệu hóa"
                            >
                              <UserX size={16} />
                            </button>
                            <button
                              className={`${styles.actionButton} ${styles.danger}`}
                              onClick={() => handleStatusChange(user.userId, AccountStatus.REVOKED)}
                              title="Thu hồi quyền"
                            >
                              <Shield size={16} />
                            </button>
                          </>
                        )}
                        {(user.status === AccountStatus.DEACTIVATED || user.status === AccountStatus.REVOKED) && (
                          <button
                            className={`${styles.actionButton} ${styles.success}`}
                            onClick={() => handleStatusChange(user.userId, AccountStatus.ACTIVE)}
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

        {/* Create Single User Modal */}
        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => { setShowCreateModal(false); loadUsers(); }}
          />
        )}

        {/* Bulk Create Modal */}
        {showBulkModal && (
          <BulkCreateModal
            onClose={() => setShowBulkModal(false)}
            onSuccess={() => { setShowBulkModal(false); loadUsers(); }}
          />
        )}
      </div>
    </MainLayout>
  );
}

// ==========================================
// Single User Create Modal
// ==========================================
interface CreateUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateUserModal({ onClose, onSuccess }: CreateUserModalProps) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    role: UserRole.USER,
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
      });
      onSuccess();
    } catch (err: unknown) {
      // Log for debugging
      console.error('Create user error:', err);

      // Extract error message from various possible structures
      const axiosErr = err as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string };
      const serverMsg = axiosErr?.response?.data?.message || axiosErr?.response?.data?.error;
      const httpStatus = axiosErr?.response?.status;

      // If server returns email failure warning, show warning banner (not error)
      if (serverMsg && (
        serverMsg.includes('email thất bại') ||
        serverMsg.includes('Tạo người dùng thành công')
      )) {
        setError(serverMsg);
      } else if (httpStatus === 400 || httpStatus === 409) {
        // Validation or conflict error - show server message
        setError(serverMsg || 'Dữ liệu không hợp lệ');
      } else if (httpStatus === 500) {
        // Server error - check for email warning first
        setError(serverMsg || 'Lỗi máy chủ. Vui lòng thử lại sau.');
      } else {
        setError(serverMsg || 'Tạo người dùng thất bại');
      }
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
          <button className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
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
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Hủy
            </button>
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

// ==========================================
// Bulk Create Modal
// ==========================================
interface BulkCreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function BulkCreateModal({ onClose, onSuccess }: BulkCreateModalProps) {
  const [users, setUsers] = useState<Array<{
    username: string;
    email: string;
    fullName: string;
    role: string;
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
    setUsers(u => [...u, { username: '', email: '', fullName: '', role: 'USER', status: 'ok' }]);
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
      })));
      setSuccessCount(result.successfulUsers?.length || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Tạo hàng loạt thất bại';
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
          <button className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successCount > 0 && (
            <div className={styles.successBanner}>
              <CheckCircle size={16} />
              <span>Đã tạo thành công {successCount} người dùng. Email thông tin tài khoản đã được gửi.</span>
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
                    <td>
                      <input
                        type="text"
                        value={row.username}
                        onChange={e => updateRow(idx, 'username', e.target.value)}
                        placeholder="username"
                        className={styles.inlineInput}
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={row.email}
                        onChange={e => updateRow(idx, 'email', e.target.value)}
                        placeholder="email@company.com"
                        className={styles.inlineInput}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.fullName}
                        onChange={e => updateRow(idx, 'fullName', e.target.value)}
                        placeholder="Họ và tên"
                        className={styles.inlineInput}
                      />
                    </td>
                    <td>
                      <select
                        value={row.role}
                        onChange={e => updateRow(idx, 'role', e.target.value)}
                        className={styles.inlineSelect}
                      >
                        <option value="USER">USER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td>
                      <button type="button" className={styles.removeRowBtn} onClick={() => removeRow(idx)}>
                        <X size={14} />
                      </button>
                    </td>
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
            <button type="button" className={styles.addRowButton} onClick={addRow}>
              <Plus size={14} /> Thêm dòng
            </button>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Đóng
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || users.length === 0}
            >
              {loading ? <Loader2 size={16} className={styles.spinner} /> : <CheckCircle size={16} />}
              Tạo {users.filter(u => u.status === 'ok').length} người dùng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
