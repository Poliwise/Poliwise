'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Shield,
  Building,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import styles from './profile.module.css';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
  passwordChangedAt: string | null;
  mustChangePassword: boolean;
}

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, [isAuthenticated]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await api.auth.getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }

    try {
      setIsChangingPassword(true);
      const result = await api.auth.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      if (result.success) {
        setPasswordSuccess(true);
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(result.message);
      }
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setPasswordError(
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Đã xảy ra lỗi khi đổi mật khẩu'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { label: 'Yếu', color: '#ef4444', strength };
    if (strength <= 4) return { label: 'Trung bình', color: '#f59e0b', strength };
    return { label: 'Mạnh', color: '#22c55e', strength };
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: 'Quản trị viên',
      MANAGER: 'Quản lý',
      USER: 'Người dùng',
    };
    return labels[role] || role;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Chưa có';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Đang tải thông tin...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Hồ sơ cá nhân</h1>
        <p className={styles.pageSubtitle}>Quản lý thông tin tài khoản của bạn</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'profile' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={18} />
          Thông tin cá nhân
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'security' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={18} />
          Bảo mật
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'profile' && profile && (
          <div className={styles.profileCard}>
            <div className={styles.avatarSection}>
              <div className={styles.avatar}>
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className={styles.avatarInfo}>
                <h2 className={styles.username}>{profile.username}</h2>
                <span className={`${styles.roleBadge} ${styles[profile.role.toLowerCase()]}`}>
                  {getRoleLabel(profile.role)}
                </span>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <User size={18} />
                </div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Tên đăng nhập</span>
                  <span className={styles.infoValue}>{profile.username}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <Mail size={18} />
                </div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{profile.email}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <Shield size={18} />
                </div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Vai trò</span>
                  <span className={styles.infoValue}>{getRoleLabel(profile.role)}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <Building size={18} />
                </div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Phòng ban</span>
                  <span className={styles.infoValue}>
                    {profile.departmentName || 'Chưa phân phòng ban'}
                  </span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <Calendar size={18} />
                </div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Ngày tạo tài khoản</span>
                  <span className={styles.infoValue}>{formatDate(profile.createdAt)}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <Lock size={18} />
                </div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Đổi mật khẩu lần cuối</span>
                  <span className={styles.infoValue}>
                    {formatDate(profile.passwordChangedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className={styles.securityCard}>
            <h2 className={styles.sectionTitle}>Đổi mật khẩu</h2>
            <p className={styles.sectionDescription}>
              Cập nhật mật khẩu để bảo vệ tài khoản của bạn
            </p>

            {passwordSuccess && (
              <div className={styles.successMessage}>
                <CheckCircle size={18} />
                <span>Đổi mật khẩu thành công!</span>
              </div>
            )}

            {passwordError && (
              <div className={styles.errorMessage}>
                <AlertCircle size={18} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className={styles.passwordForm}>
              <Input
                label="Mật khẩu hiện tại"
                type={showPasswords.old ? 'text' : 'password'}
                value={passwordForm.oldPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
                }
                placeholder="Nhập mật khẩu hiện tại"
                required
                autoComplete="current-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, old: !showPasswords.old })}
                    className={styles.passwordToggle}
                  >
                    {showPasswords.old ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <div className={styles.passwordStrength}>
                {passwordForm.newPassword && (
                  <div className={styles.strengthIndicator}>
                    <div
                      className={styles.strengthBar}
                      style={{
                        width: `${Math.min(100, (getPasswordStrength(passwordForm.newPassword).strength || 0) * 20)}%`,
                        backgroundColor: getPasswordStrength(passwordForm.newPassword).color,
                      }}
                    />
                    <span
                      className={styles.strengthLabel}
                      style={{ color: getPasswordStrength(passwordForm.newPassword).color }}
                    >
                      {getPasswordStrength(passwordForm.newPassword).label}
                    </span>
                  </div>
                )}
              </div>

              <Input
                label="Mật khẩu mới"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                placeholder="Nhập mật khẩu mới"
                required
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className={styles.passwordToggle}
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <Input
                label="Xác nhận mật khẩu mới"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                placeholder="Nhập lại mật khẩu mới"
                required
                autoComplete="new-password"
                error={
                  passwordForm.confirmPassword &&
                  passwordForm.newPassword !== passwordForm.confirmPassword
                    ? 'Mật khẩu không khớp'
                    : undefined
                }
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className={styles.passwordToggle}
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <div className={styles.passwordRequirements}>
                <p>Mật khẩu phải có:</p>
                <ul>
                  <li className={passwordForm.newPassword.length >= 8 ? styles.met : ''}>
                    Ít nhất 8 ký tự
                  </li>
                  <li className={/[A-Z]/.test(passwordForm.newPassword) ? styles.met : ''}>
                    Ít nhất 1 chữ hoa
                  </li>
                  <li className={/[a-z]/.test(passwordForm.newPassword) ? styles.met : ''}>
                    Ít nhất 1 chữ thường
                  </li>
                  <li className={/[0-9]/.test(passwordForm.newPassword) ? styles.met : ''}>
                    Ít nhất 1 số
                  </li>
                  <li className={/[^a-zA-Z0-9]/.test(passwordForm.newPassword) ? styles.met : ''}>
                    Ít nhất 1 ký tự đặc biệt
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={isChangingPassword}
                disabled={
                  isChangingPassword ||
                  !passwordForm.oldPassword ||
                  !passwordForm.newPassword ||
                  !passwordForm.confirmPassword ||
                  passwordForm.newPassword !== passwordForm.confirmPassword
                }
              >
                Đổi mật khẩu
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
