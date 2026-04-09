'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Mail, Building, Shield, Clock, Loader2, Save } from 'lucide-react';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import { UserRole } from '@/types';
import styles from './profile.module.css';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    department: '',
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await api.users.getMe();
      setFormData({
        fullName: profile.fullName || '',
        email: profile.email || '',
        department: profile.departmentName || '',
      });
      updateUser(profile);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.users.updateMe(formData);
      updateUser(formData);
      alert('Cập nhật thành công!');
    } catch {
      console.error('Failed to update profile:');
      alert('Cập nhật thất bại!');
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'Quản trị viên';
      case UserRole.MANAGER: return 'Quản lý';
      default: return 'Người dùng';
    }
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return styles.badgeAdmin;
      case UserRole.MANAGER: return styles.badgeManager;
      default: return styles.badgeUser;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className={styles.loading}>
          <Loader2 size={32} className={styles.spinner} />
          <span>Đang tải...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Trang cá nhân</h1>
          <p>Quản lý thông tin tài khoản của bạn</p>
        </div>

        <div className={styles.content}>
          {/* Profile Card */}
          <div className={styles.profileCard}>
            <div className={styles.avatarSection}>
              <div className={styles.avatar}>
                <User size={48} />
              </div>
              <div className={styles.userInfo}>
                <h2>{user?.username}</h2>
                <span className={`${styles.badge} ${getRoleBadgeClass(user?.role as UserRole)}`}>
                  <Shield size={14} />
                  {getRoleLabel(user?.role as UserRole)}
                </span>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <Mail size={18} />
                <div>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{user?.email}</span>
                </div>
              </div>
              <div className={styles.infoItem}>
                <Building size={18} />
                <div>
                  <span className={styles.infoLabel}>Phòng ban</span>
                  <span className={styles.infoValue}>{user?.departmentName || 'Chưa cập nhật'}</span>
                </div>
              </div>
              <div className={styles.infoItem}>
                <Clock size={18} />
                <div>
                  <span className={styles.infoLabel}>Ngày tham gia</span>
                  <span className={styles.infoValue}>
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US') : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className={styles.formCard}>
            <h3>Thông tin cá nhân</h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="username">Tên đăng nhập</label>
                <input
                  id="username"
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className={styles.disabledInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="fullName">Họ và tên</label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Nhập email"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="department">Phòng ban</label>
                <input
                  id="department"
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Nhập phòng ban"
                />
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.saveButton} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={18} className={styles.spinner} />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
