'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import { AccountStatus } from '@/types';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.auth.login({ username, password });

      // Store user info first
      setUser({
        userId: response.user.userId,
        username: response.user.username,
        email: response.user.email,
        role: response.user.role,
        status: AccountStatus.ACTIVE,
        department: null,
      });

      // Store tokens (this also sets isAuthenticated)
      setTokens(response.accessToken, response.refreshToken);

      // Store in localStorage for API client
      if (typeof window !== 'undefined') {
        localStorage.setItem('userId', response.user.userId);
        localStorage.setItem('userRole', response.user.role);
      }

      router.push('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      if (error.response?.data?.error?.message) {
        setError(error.response.data.error.message);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
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
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              Tên đăng nhập
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              placeholder="Nhập tên đăng nhập"
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Mật khẩu
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Nhập mật khẩu"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <NextLink href="/forgot-password" className={styles.forgotLink}>
              Quên mật khẩu?
            </NextLink>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className={styles.spinner} />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <span>Đăng nhập</span>
            )}
          </button>
        </form>

          <p className={styles.footer}>
            Cần tài khoản? Liên hệ{' '}
            <span className={styles.adminContact}>
              Quản trị viên
            </span>{' '}
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
