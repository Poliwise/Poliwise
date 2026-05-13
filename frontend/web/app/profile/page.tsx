'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Phone,
  Briefcase,
  FileText,
  Camera,
  Clock,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import { LoginHistoryModal } from '@/components/profile/LoginHistoryModal';
import styles from './profile.module.css';

type TabKey = 'profile' | 'edit' | 'security';

interface FullProfile {
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
  fullName?: string;
  phone?: string | null;
  position?: string | null;
  bio?: string | null;
  dateOfBirth?: string | null;
  employeeCode?: string | null;
  joinedDate?: string | null;
}

interface EditFormData {
  fullName: string;
  phone: string;
  position: string;
  bio: string;
  dateOfBirth: string;
}

const EMPTY_EDIT: EditFormData = {
  fullName: '',
  phone: '',
  position: '',
  bio: '',
  dateOfBirth: '',
};

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  const [editForm, setEditForm] = useState<EditFormData>(EMPTY_EDIT);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditFormData, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, [isAuthenticated]);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.profile.getFull();
      setProfile(data as FullProfile);
      setEditForm({
        fullName: (data as FullProfile).fullName || '',
        phone: (data as FullProfile).phone || '',
        position: (data as FullProfile).position || '',
        bio: (data as FullProfile).bio || '',
        dateOfBirth: (data as FullProfile).dateOfBirth || '',
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateEditForm = (): boolean => {
    const errors: Partial<Record<keyof EditFormData, string>> = {};
    if (!editForm.fullName.trim()) {
      errors.fullName = 'Họ tên là bắt buộc';
    } else if (editForm.fullName.trim().length > 200) {
      errors.fullName = 'Họ tên không được vượt quá 200 ký tự';
    }
    if (editForm.phone && !/^\+?[0-9]{7,15}$/.test(editForm.phone.replace(/\s/g, ''))) {
      errors.phone = 'Số điện thoại không hợp lệ';
    }
    if (editForm.bio && editForm.bio.length > 1000) {
      errors.bio = 'Giới thiệu không được vượt quá 1000 ký tự';
    }
    if (editForm.position && editForm.position.length > 200) {
      errors.position = 'Chức danh không được vượt quá 200 ký tự';
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(false);
    if (!validateEditForm()) return;

    try {
      setIsSaving(true);
      await api.profile.update({
        fullName: editForm.fullName.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        position: editForm.position.trim() || undefined,
        bio: editForm.bio.trim() || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
      });
      setEditSuccess(true);
      await loadProfile();
      setTimeout(() => setEditSuccess(false), 4000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Đã xảy ra lỗi khi lưu thông tin';
      setEditError(msg);
    } finally {
      setIsSaving(false);
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
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      setPasswordError(
        axiosError.response?.data?.message || axiosError.message || 'Đã xảy ra lỗi khi đổi mật khẩu'
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
    const labels: Record<string, string> = { ADMIN: 'Quản trị viên', MANAGER: 'Quản lý', USER: 'Người dùng' };
    return labels[role] || role;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Chưa có';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
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
        <p className={styles.pageSubtitle}>Quản lý thông tin tài khoản và bảo mật của bạn</p>
      </div>

      <div className={styles.tabs}>
        {(['profile', 'edit', 'security'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'profile' && <User size={18} />}
            {tab === 'edit' && <FileText size={18} />}
            {tab === 'security' && <Lock size={18} />}
            {tab === 'profile' && 'Thông tin cá nhân'}
            {tab === 'edit' && 'Chỉnh sửa'}
            {tab === 'security' && 'Bảo mật'}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* ── Tab: Profile Info ── */}
        {activeTab === 'profile' && profile && (
          <div className={styles.profileCard}>
            <div className={styles.avatarSection}>
              <div className={styles.avatar}>
                {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : profile.username.charAt(0).toUpperCase()}
              </div>
              <div className={styles.avatarInfo}>
                <h2 className={styles.username}>{profile.fullName || profile.username}</h2>
                <span className={`${styles.roleBadge} ${styles[profile.role.toLowerCase()]}`}>
                  {getRoleLabel(profile.role)}
                </span>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><User size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Tên đăng nhập</span>
                  <span className={styles.infoValue}>{profile.username}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Mail size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{profile.email}</span>
                </div>
              </div>

              {profile.fullName && (
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><User size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Họ tên đầy đủ</span>
                    <span className={styles.infoValue}>{profile.fullName}</span>
                  </div>
                </div>
              )}

              {profile.employeeCode && (
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><Shield size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Mã nhân viên</span>
                    <span className={styles.infoValue}>{profile.employeeCode}</span>
                  </div>
                </div>
              )}

              {profile.position && (
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><Briefcase size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Chức danh</span>
                    <span className={styles.infoValue}>{profile.position}</span>
                  </div>
                </div>
              )}

              {profile.phone && (
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><Phone size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Số điện thoại</span>
                    <span className={styles.infoValue}>{profile.phone}</span>
                  </div>
                </div>
              )}

              {profile.bio && (
                <div className={`${styles.infoItem} ${styles.infoItemWide}`}>
                  <div className={styles.infoIcon}><FileText size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Giới thiệu</span>
                    <span className={styles.infoValue}>{profile.bio}</span>
                  </div>
                </div>
              )}

              {profile.dateOfBirth && (
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><Calendar size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Ngày sinh</span>
                    <span className={styles.infoValue}>{formatDate(profile.dateOfBirth)}</span>
                  </div>
                </div>
              )}

              {profile.joinedDate && (
                <div className={styles.infoItem}>
                  <div className={styles.infoIcon}><Calendar size={18} /></div>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>Ngày vào làm</span>
                    <span className={styles.infoValue}>{formatDate(profile.joinedDate)}</span>
                  </div>
                </div>
              )}

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Shield size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Vai trò</span>
                  <span className={styles.infoValue}>{getRoleLabel(profile.role)}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Building size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Phòng ban</span>
                  <span className={styles.infoValue}>{profile.departmentName || 'Chưa phân phòng ban'}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Calendar size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Ngày tạo tài khoản</span>
                  <span className={styles.infoValue}>{formatDateTime(profile.createdAt)}</span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Lock size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Đổi mật khẩu lần cuối</span>
                  <span className={styles.infoValue}>{formatDateTime(profile.passwordChangedAt)}</span>
                </div>
              </div>

              <div className={`${styles.infoItem} ${styles.infoItemSmall}`}>
                <div className={styles.infoIcon}><Clock size={18} /></div>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Lịch sử đăng nhập</span>
                  <button
                    className={styles.textButton}
                    onClick={() => setShowLoginHistory(true)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Edit Profile ── */}
        {activeTab === 'edit' && (
          <div className={styles.editCard}>
            <div className={styles.editHeader}>
              <h2 className={styles.sectionTitle}>Chỉnh sửa hồ sơ</h2>
              <p className={styles.sectionDescription}>
                Cập nhật thông tin cá nhân của bạn. Một số trường có thể chỉ được thay đổi bởi quản trị viên.
              </p>
            </div>

            {editSuccess && (
              <div className={styles.successMessage}>
                <CheckCircle size={18} />
                <span>Lưu thông tin thành công!</span>
              </div>
            )}
            {editError && (
              <div className={styles.errorMessage}>
                <AlertCircle size={18} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className={styles.editForm}>
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Thông tin cơ bản</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <Input
                      label="Họ tên đầy đủ"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      placeholder="Nhập họ tên đầy đủ"
                      error={editErrors.fullName}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <Input
                      label="Số điện thoại"
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Ví dụ: 0912345678"
                      error={editErrors.phone}
                      helperText="7-15 chữ số, có thể bắt đầu bằng +"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <Input
                      label="Chức danh / Vị trí công tác"
                      value={editForm.position}
                      onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                      placeholder="Ví dụ: Kỹ sư phần mềm"
                      error={editErrors.position}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <Input
                      label="Ngày sinh"
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                      error={editErrors.dateOfBirth}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Giới thiệu bản thân</h3>
                <div className={styles.formGroupFull}>
                  <label className={styles.textareaLabel}>
                    Mô tả / Bio
                    <span className={styles.charCount}>
                      {editForm.bio.length} / 1000
                    </span>
                  </label>
                  <textarea
                    className={`${styles.textarea} ${editErrors.bio ? styles.textareaError : ''}`}
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Viết vài dòng giới thiệu về bản thân, sở thích, kinh nghiệm làm việc..."
                    rows={4}
                    maxLength={1000}
                  />
                  {editErrors.bio && (
                    <span className={styles.fieldError}>{editErrors.bio}</span>
                  )}
                </div>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (profile) {
                      setEditForm({
                        fullName: profile.fullName || '',
                        phone: profile.phone || '',
                        position: profile.position || '',
                        bio: profile.bio || '',
                        dateOfBirth: profile.dateOfBirth || '',
                      });
                    }
                    setEditErrors({});
                    setEditError(null);
                    setEditSuccess(false);
                  }}
                >
                  Đặt lại
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSaving}
                  disabled={isSaving}
                >
                  <CheckCircle size={16} />
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab: Security ── */}
        {activeTab === 'security' && (
          <div className={styles.securityCard}>
            <h2 className={styles.sectionTitle}>Đổi mật khẩu</h2>
            <p className={styles.sectionDescription}>
              Cập nhật mật khẩu để bảo vệ tài khoản của bạn. Mật khẩu phải có ít nhất 8 ký tự.
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
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                placeholder="Nhập mật khẩu hiện tại"
                required
                autoComplete="current-password"
                rightIcon={
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, old: !showPasswords.old })} className={styles.passwordToggle}>
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
                    <span className={styles.strengthLabel} style={{ color: getPasswordStrength(passwordForm.newPassword).color }}>
                      {getPasswordStrength(passwordForm.newPassword).label}
                    </span>
                  </div>
                )}
              </div>

              <Input
                label="Mật khẩu mới"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Nhập mật khẩu mới"
                required
                autoComplete="new-password"
                rightIcon={
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className={styles.passwordToggle}>
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <Input
                label="Xác nhận mật khẩu mới"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Nhập lại mật khẩu mới"
                required
                autoComplete="new-password"
                error={
                  passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
                    ? 'Mật khẩu không khớp'
                    : undefined
                }
                rightIcon={
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className={styles.passwordToggle}>
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <div className={styles.passwordRequirements}>
                <p>Mật khẩu phải có:</p>
                <ul>
                  <li className={passwordForm.newPassword.length >= 8 ? styles.met : ''}>Ít nhất 8 ký tự</li>
                  <li className={/[A-Z]/.test(passwordForm.newPassword) ? styles.met : ''}>Ít nhất 1 chữ hoa</li>
                  <li className={/[a-z]/.test(passwordForm.newPassword) ? styles.met : ''}>Ít nhất 1 chữ thường</li>
                  <li className={/[0-9]/.test(passwordForm.newPassword) ? styles.met : ''}>Ít nhất 1 số</li>
                  <li className={/[^a-zA-Z0-9]/.test(passwordForm.newPassword) ? styles.met : ''}>Ít nhất 1 ký tự đặc biệt</li>
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

      <LoginHistoryModal
        open={showLoginHistory}
        onClose={() => setShowLoginHistory(false)}
        userId={profile?.id ?? ''}
      />
    </div>
  );
}
