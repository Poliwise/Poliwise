'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, MessageSquare, CheckCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import styles from './reset-password.module.css';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
    }
  }, [token]);

  const validate = (): string | null => {
    if (!password) return 'Mật khẩu không được để trống.';
    if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
    if (password !== confirmPassword) return 'Mật khẩu xác nhận không khớp.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Call backend reset password endpoint
      // If endpoint doesn't exist, API will fail — handle gracefully
      await (window as unknown as {
        fetch: (url: string, opts: unknown) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
      }).fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setError(
        axiosError.response?.data?.error?.message ||
        axiosError.message ||
        'Đã xảy ra lỗi khi đặt lại mật khẩu. Liên kết có thể đã hết hạn.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (invalidToken) {
    return (
      <div className={styles.container}>
        <div className={styles.formContainer}>
          <div className={styles.errorCard}>
            <div className={styles.errorIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className={styles.errorTitle}>Liên kết không hợp lệ</h1>
            <p className={styles.errorMessage}>
              Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
              Vui lòng yêu cầu liên kết mới.
            </p>
            <Link href="/forgot-password" className={styles.requestLink}>
              Yêu cầu liên kết mới
            </Link>
          </div>
        </div>
        <div className={styles.background}>
          <div className={styles.gradient} />
          <div className={styles.pattern} />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.formContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>
              <CheckCircle size={40} />
            </div>
            <h1 className={styles.successTitle}>Đặt lại mật khẩu thành công</h1>
            <p className={styles.successMessage}>
              Mật khẩu của bạn đã được thay đổi. Bây giờ bạn có thể đăng nhập với mật khẩu mới.
            </p>
            <Link href="/login" className={styles.loginLink}>
              Đăng nhập ngay
            </Link>
          </div>
        </div>
        <div className={styles.background}>
          <div className={styles.gradient} />
          <div className={styles.pattern} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <Link href="/login" className={styles.backButton}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Quay lại đăng nhập</span>
        </Link>

        <div className={styles.header}>
          <div className={styles.logo}>
            <MessageSquare size={28} />
          </div>
          <h1 className={styles.title}>Đặt lại mật khẩu</h1>
          <p className={styles.subtitle}>Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <Input
            label="Mật khẩu mới"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ít nhất 8 ký tự"
            required
            autoComplete="new-password"
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

          <Input
            label="Xác nhận mật khẩu mới"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            required
            autoComplete="new-password"
            error={confirmPassword && password !== confirmPassword ? 'Mật khẩu không khớp' : undefined}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!password || !confirmPassword || password !== confirmPassword}
          >
            {isLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
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
