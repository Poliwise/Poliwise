'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, CheckCircle, MessageSquare } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import styles from './forgot-password.module.css';

interface ForgotPasswordError {
  code: string;
  message: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ForgotPasswordError | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.auth.forgotPassword(email);
      setSuccess(true);
      setEmailSent(response.emailSent);
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
        message: errorMessage || fallbackMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <div className={styles.header}>
          <Link href="/login" className={styles.backLink}>
            <ArrowLeft size={18} />
            <span>Quay lại đăng nhập</span>
          </Link>

          <div className={styles.logo}>
            <MessageSquare size={32} />
          </div>
          <h1 className={styles.title}>Quên mật khẩu?</h1>
          <p className={styles.subtitle}>
            Không sao cả! Nhập email của bạn và chúng tôi sẽ gửi mật khẩu mới.
          </p>
        </div>

        {success ? (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>
              <CheckCircle size={48} />
            </div>
            <h2 className={styles.successTitle}>Kiểm tra email của bạn!</h2>
            <p className={styles.successText}>
              {emailSent
                ? 'Chúng tôi đã gửi mật khẩu mới đến email của bạn. Vui lòng kiểm tra hộp thư và đăng nhập với mật khẩu mới.'
                : 'Nếu email tồn tại trong hệ thống, mật khẩu mới sẽ được gửi đến email của bạn.'}
            </p>
            <p className={styles.emailNote}>
              Email: <strong>{email}</strong>
            </p>
            <div className={styles.successActions}>
              <Button
                variant="primary"
                onClick={() => router.push('/login')}
                fullWidth
              >
                Quay lại đăng nhập
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.error} role="alert">
                {error.message}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email của bạn"
              required
              autoComplete="email"
              leftIcon={<Mail size={18} />}
              autoFocus
            />

            <div className={styles.helpText}>
              <p>
                Nhập email đã đăng ký với tài khoản của bạn. Chúng tôi sẽ gửi mật khẩu mới qua email.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? 'Đang xử lý...' : 'Gửi mật khẩu mới'}
            </Button>
          </form>
        )}

        <p className={styles.footer}>
          Nhớ mật khẩu rồi?{' '}
          <Link href="/login" className={styles.loginLink}>
            Đăng nhập ngay
          </Link>
        </p>
      </div>

      <div className={styles.background}>
        <div className={styles.gradient} />
        <div className={styles.pattern} />
      </div>
    </div>
  );
}
