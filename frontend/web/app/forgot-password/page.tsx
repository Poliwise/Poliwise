'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, CheckCircle, MessageSquare } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useLanguage } from '@/providers';
import styles from './forgot-password.module.css';

interface ForgotPasswordError {
  code: string;
  message: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
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
      const fallbackMessage = axiosError.message || t('login.error.unknown');

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
            <span>{t('forgot.backToLogin')}</span>
          </Link>

          <div className={styles.logo}>
            <MessageSquare size={32} />
          </div>
          <h1 className={styles.title}>{t('forgot.title')}</h1>
          <p className={styles.subtitle}>
            {t('forgot.subtitle')}
          </p>
        </div>

        {success ? (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>
              <CheckCircle size={48} />
            </div>
            <h2 className={styles.successTitle}>{t('forgot.success.title')}</h2>
            <p className={styles.successText}>
              {emailSent
                ? t('forgot.success.text.sent')
                : t('forgot.success.text.generic')}
            </p>
            <p className={styles.emailNote}>
              {t('forgot.success.email')} <strong>{email}</strong>
            </p>
            <div className={styles.successActions}>
              <Button
                variant="primary"
                onClick={() => router.push('/login')}
                fullWidth
              >
                {t('forgot.success.back')}
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
              label={t('forgot.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('forgot.email.placeholder')}
              required
              autoComplete="email"
              leftIcon={<Mail size={18} />}
              autoFocus
            />

            <div className={styles.helpText}>
              <p>
                {t('forgot.helpText')}
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
              {isLoading ? t('forgot.submitting') : t('forgot.submit')}
            </Button>
          </form>
        )}

        <p className={styles.footer}>
          {t('forgot.rememberPassword')}{' '}
          <Link href="/login" className={styles.loginLink}>
            {t('forgot.loginNow')}
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
