'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';
import { Button, Input, Checkbox } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import { AccountStatus } from '@/types';
import styles from './login.module.css';

interface LoginError {
  code: string;
  message: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Tên đăng nhập hoặc mật khẩu không đúng.',
  ACCOUNT_DEACTIVATED: 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.',
  ACCOUNT_REVOKED: 'Tài khoản đã bị thu hồi. Liên hệ quản trị viên.',
  RATE_LIMIT_EXCEEDED: 'Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau.',
  VALIDATION_ERROR: 'Thông tin đăng nhập không hợp lệ.',
};

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.auth.login({ username, password });

      setUser({
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        role: response.user.role,
        status: AccountStatus.ACTIVE,
        department: null,
      });
      setTokens(response.accessToken, response.refreshToken);

      if (typeof window !== 'undefined') {
        localStorage.setItem('userId', response.user.id);
        localStorage.setItem('userRole', response.user.role);
        if (rememberMe) {
          localStorage.setItem('rememberUsername', username);
        } else {
          localStorage.removeItem('rememberUsername');
        }
      }

      router.push('/');
    } catch (err: unknown) {
      const axiosError = err as {
        response?: {
          data?: {
            success?: boolean;
            error?: { code?: string; message?: string };
          };
        };
        message?: string;
      };
      const errorCode = axiosError.response?.data?.error?.code;
      const errorMessage = axiosError.response?.data?.error?.message;
      const fallbackMessage = axiosError.message || 'Đã xảy ra lỗi không xác định.';

      setError({
        code: errorCode || 'UNKNOWN',
        message: errorMessage || ERROR_MESSAGES[errorCode || ''] || fallbackMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <MessageSquare size={32} />
          </div>
          <h1 className={styles.title}>Chào mừng bạn</h1>
          <p className={styles.subtitle}>Đăng nhập để tiếp tục với Poliwise</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error} role="alert">
              {error.message}
            </div>
          )}

          <Input
            label="Tên đăng nhập"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên đăng nhập"
            required
            autoComplete="username"
            leftIcon={<span className={styles.inputIcon}>@</span>}
            autoFocus
          />

          <Input
            label="Mật khẩu"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            required
            autoComplete="current-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.passwordToggle}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <div className={styles.rememberRow}>
            <Checkbox
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label="Ghi nhớ tôi"
            />
            <Link href="/forgot-password" className={styles.forgotLink}>
              Quên mật khẩu?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isLoading || !username.trim() || !password}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        <p className={styles.footer}>
          Cần tài khoản? Liên hệ{' '}
          <span className={styles.adminContact}>Quản trị viên</span>{' '}
          để được tạo tài khoản.
        </p>
      </div>

      <div className={styles.background}>
        <div className={styles.gradient} />
        <div className={styles.pattern} />
      </div>
    </div>
  );
}
