'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, UserPlus } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { UserRole } from '@/types';
import styles from './register.module.css';

const roleOptions = [
  { value: UserRole.USER, label: 'Người dùng' },
  { value: UserRole.MANAGER, label: 'Quản lý' },
  { value: UserRole.ADMIN, label: 'Quản trị viên' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: UserRole.USER,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Inline validation
    if (!formData.username.trim()) {
      setError('Tên đăng nhập không được để trống.');
      return;
    }
    if (formData.username.trim().length < 3) {
      setError('Tên đăng nhập phải có ít nhất 3 ký tự.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) {
      setError('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email không được để trống.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Email không hợp lệ.');
      return;
    }
    if (!formData.password) {
      setError('Mật khẩu không được để trống.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.auth.register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });
      setSuccess(`Tài khoản "${formData.username}" đã được tạo thành công. Người dùng có thể đăng nhập ngay.`);
      setFormData({ username: '', email: '', password: '', confirmPassword: '', role: UserRole.USER });
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setError(
        axiosError.response?.data?.error?.message ||
        axiosError.message ||
        'Đã xảy ra lỗi khi tạo tài khoản.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <button
          type="button"
          onClick={() => router.back()}
          className={styles.backButton}
        >
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <div className={styles.header}>
          <div className={styles.logo}>
            <MessageSquare size={28} />
          </div>
          <h1 className={styles.title}>Tạo tài khoản mới</h1>
          <p className={styles.subtitle}>Điền thông tin để tạo tài khoản cho người dùng mới</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className={styles.success} role="status">
              <UserPlus size={18} />
              <span>{success}</span>
            </div>
          )}

          <Input
            label="Tên đăng nhập"
            type="text"
            value={formData.username}
            onChange={handleChange('username')}
            placeholder="VD: nguyen.van.a"
            required
            autoComplete="username"
            helperText="Chỉ chứa chữ cái, số và dấu gạch dưới"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            placeholder="VD: nguyenvana@example.com"
            required
            autoComplete="email"
          />

          <Select
            label="Vai trò"
            value={formData.role}
            onChange={handleChange('role')}
            options={roleOptions}
            required
            helperText="Quyền hạn của tài khoản sẽ được áp dụng dựa trên vai trò"
          />

          <Input
            label="Mật khẩu"
            type="password"
            value={formData.password}
            onChange={handleChange('password')}
            placeholder="Ít nhất 8 ký tự"
            required
            autoComplete="new-password"
          />

          <Input
            label="Xác nhận mật khẩu"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange('confirmPassword')}
            placeholder="Nhập lại mật khẩu"
            required
            autoComplete="new-password"
            error={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'Mật khẩu không khớp' : undefined}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            icon={<UserPlus size={18} />}
          >
            {isLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </Button>
        </form>
      </div>

      <div className={styles.background}>
        <div className={styles.gradient} />
        <div className={styles.pattern} />
      </div>
    </div>
  );
}
