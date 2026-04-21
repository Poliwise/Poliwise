'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare, CheckCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import styles from './forgot-password.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Forgot password endpoint — backend should handle email sending
      // If endpoint doesn't exist yet, the API call will fail with a clear error
      await (api as unknown as { auth: { forgotPassword: (email: string) => Promise<void> } }).auth.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setError(
        axiosError.response?.data?.error?.message ||
        axiosError.message ||
        'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.container}>
        <div className={styles.formContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>
              <CheckCircle size={40} />
            </div>
            <h1 className={styles.successTitle}>Đã gửi email đặt lại mật khẩu</h1>
            <p className={styles.successMessage}>
              Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến <strong>{email}</strong>.
              Vui lòng kiểm tra hộp thư và làm theo hướng dẫn trong email.
            </p>
            <p className={styles.successNote}>
              Không nhận được email? Kiểm tra thư mục spam hoặc{' '}
              <button
                type="button"
                className={styles.resendLink}
                onClick={() => setSent(false)}
              >
                thử lại
              </button>
              .
            </p>
            <Link href="/login" className={styles.backLink}>
              <ArrowLeft size={16} />
              Quay lại trang đăng nhập
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
          <ArrowLeft size={18} />
          <span>Quay lại đăng nhập</span>
        </Link>

        <div className={styles.header}>
          <div className={styles.logo}>
            <MessageSquare size={28} />
          </div>
          <h1 className={styles.title}>Quên mật khẩu?</h1>
          <p className={styles.subtitle}>
            Nhập địa chỉ email của bạn và chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Nhập email đã đăng ký"
            required
            autoComplete="email"
            leftIcon={<Mail size={18} />}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!email.trim()}
          >
            {isLoading ? 'Đang gửi...' : 'Gửi hướng dẫn'}
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
