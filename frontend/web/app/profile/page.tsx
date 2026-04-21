'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Mail, Building, Shield, Clock, Save, KeyRound, Monitor } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Avatar,
  Badge,
  Spinner,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import { UserRole } from '@/types';
import styles from './profile.module.css';

const ROLE_CONFIG = {
  [UserRole.ADMIN]: { label: 'Quản trị viên', variant: 'destructive' as const },
  [UserRole.MANAGER]: { label: 'Quản lý', variant: 'info' as const },
  [UserRole.USER]: { label: 'Người dùng', variant: 'success' as const },
};

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', department: '' });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const profile = await api.users.getMe();
      setFormData({
        fullName: profile.fullName || '',
        email: profile.email || '',
        department: profile.departmentName || '',
      });
      updateUser(profile);
    } catch {
      // Use store data as fallback
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
    setSaveSuccess(false);
    try {
      const updated = await api.users.updateMe({
        fullName: formData.fullName,
        email: formData.email,
      });
      updateUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // error handled in UI
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="lg" label="Đang tải thông tin..." />
        </div>
      </div>
    );
  }

  const roleConfig = user?.role ? ROLE_CONFIG[user.role] : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Trang cá nhân</h1>
        <p>Quản lý thông tin tài khoản và bảo mật của bạn</p>
      </div>

      <div className={styles.grid}>
        {/* Profile Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin tài khoản</CardTitle>
            <CardDescription>Thông tin cơ bản của tài khoản</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.profileHeader}>
              <Avatar name={user?.username} size="xl" />
              <div className={styles.profileMeta}>
                <h2 className={styles.username}>{user?.username}</h2>
                {roleConfig && (
                  <Badge variant={roleConfig.variant} icon={<Shield size={12} />}>
                    {roleConfig.label}
                  </Badge>
                )}
              </div>
            </div>

            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <Mail size={16} />
                <div>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{user?.email || '-'}</span>
                </div>
              </div>
              <div className={styles.infoItem}>
                <Building size={16} />
                <div>
                  <span className={styles.infoLabel}>Phòng ban</span>
                  <span className={styles.infoValue}>{user?.departmentName || 'Chưa cập nhật'}</span>
                </div>
              </div>
              <div className={styles.infoItem}>
                <Clock size={16} />
                <div>
                  <span className={styles.infoLabel}>Ngày tham gia</span>
                  <span className={styles.infoValue}>
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '-'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Chỉnh sửa thông tin</CardTitle>
            <CardDescription>Cập nhật thông tin cá nhân của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                label="Tên đăng nhập"
                value={user?.username || ''}
                disabled
                helperText="Tên đăng nhập không thể thay đổi"
              />

              <Input
                label="Họ và tên"
                value={formData.fullName}
                onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Nhập họ và tên"
              />

              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="Nhập email"
                required
              />

              <Input
                label="Phòng ban"
                value={formData.department}
                onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
                placeholder="Nhập phòng ban"
              />

              {saveSuccess && (
                <div className={styles.successMsg}>
                  Cập nhật thành công!
                </div>
              )}

              <Button type="submit" variant="primary" loading={saving} icon={<Save size={16} />}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Security Section */}
      <div className={styles.securitySection}>
        <h2 className={styles.sectionTitle}>Bảo mật</h2>
        <div className={styles.securityGrid}>
          <Card padding="md">
            <div className={styles.securityItem}>
              <div className={styles.securityIcon}>
                <KeyRound size={20} />
              </div>
              <div className={styles.securityInfo}>
                <h3>Đổi mật khẩu</h3>
                <p>Thay đổi mật khẩu định kỳ để bảo vệ tài khoản</p>
              </div>
              <Link href="/profile/change-password" className={styles.securityLink}>
                <Button variant="outline" size="sm">
                  Đổi mật khẩu
                </Button>
              </Link>
            </div>
          </Card>

          <Card padding="md">
            <div className={styles.securityItem}>
              <div className={styles.securityIcon}>
                <Monitor size={20} />
              </div>
              <div className={styles.securityInfo}>
                <h3>Phiên đăng nhập</h3>
                <p>Xem và quản lý các thiết bị đang đăng nhập</p>
              </div>
              <Link href="/profile/sessions" className={styles.securityLink}>
                <Button variant="outline" size="sm">
                  Quản lý phiên
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
