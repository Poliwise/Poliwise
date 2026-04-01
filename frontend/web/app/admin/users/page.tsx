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
      await api.users.updateStatus(userId, status);
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
      </div>
    </MainLayout>
  );
}
