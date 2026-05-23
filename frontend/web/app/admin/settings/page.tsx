'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Bell,
  Globe,
  KeyRound,
  Clock,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  Button,
  Switch,
  Select,
  Tabs,
} from '@/components/ui';
import { MainLayout } from '@/components/layout';
import { useLanguage } from '@/providers';
import { usePreferencesStore } from '@/store';
import styles from './settings.module.css';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = usePreferencesStore();
  const [localTimezone, setLocalTimezone] = useState(
    typeof window !== 'undefined'
      ? (localStorage.getItem('timezone') ?? 'Asia/Ho_Chi_Minh')
      : 'Asia/Ho_Chi_Minh'
  );
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifUnanswered, setNotifUnanswered] = useState(true);
  const [notifReport, setNotifReport] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem('timezone', localTimezone);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    {
      value: 'general',
      label: t('settings.tab.general'),
      icon: <Globe size={16} />,
      content: (
        <div className={styles.settingsSection}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.language')}</h3>
              <p>{t('settings.language.desc')}</p>
            </div>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}
              options={[
                { value: 'vi', label: t('settings.lang.vi') },
                { value: 'en', label: t('settings.lang.en') },
              ]}
              selectSize="sm"
              className={styles.settingSelect}
            />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.timezone')}</h3>
              <p>{t('settings.timezone.desc')}</p>
            </div>
            <Select
              value={localTimezone}
              onChange={(e) => setLocalTimezone(e.target.value)}
              options={TIMEZONE_OPTIONS}
              selectSize="sm"
              className={styles.settingSelect}
            />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.darkMode')}</h3>
              <p>{t('settings.darkMode.desc')}</p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
            />
          </div>
        </div>
      ),
    },
    {
      value: 'notifications',
      label: t('settings.tab.notifications'),
      icon: <Bell size={16} />,
      content: (
        <div className={styles.settingsSection}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.notif.email')}</h3>
              <p>{t('settings.notif.email.desc')}</p>
            </div>
            <Switch checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.notif.unanswered')}</h3>
              <p>{t('settings.notif.unanswered.desc')}</p>
            </div>
            <Switch checked={notifUnanswered} onChange={(e) => setNotifUnanswered(e.target.checked)} />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.notif.report')}</h3>
              <p>{t('settings.notif.report.desc')}</p>
            </div>
            <Switch checked={notifReport} onChange={(e) => setNotifReport(e.target.checked)} />
          </div>
        </div>
      ),
    },
    {
      value: 'security',
      label: t('settings.tab.security'),
      icon: <Shield size={16} />,
      content: (
        <div className={styles.settingsSection}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.security.changePassword')}</h3>
              <p>{t('settings.security.changePassword.desc')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<KeyRound size={16} />}
              onClick={() => router.push('/profile/change-password')}
            >
              {t('settings.security.changePassword')}
            </Button>
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>{t('settings.security.sessions')}</h3>
              <p>{t('settings.security.sessions.desc')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Clock size={16} />}
              onClick={() => router.push('/profile/sessions')}
            >
              {t('settings.security.sessions')}
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>{t('settings.title')}</h1>
            <p>{t('settings.subtitle')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={16} />}
            loading={saving}
            onClick={handleSave}
          >
            {saving ? t('settings.saving') : t('settings.save')}
          </Button>
        </div>

        {saved && (
          <div className={styles.savedBanner}>
            <RefreshCw size={16} />
            <span>{t('settings.saved')}</span>
          </div>
        )}

        <Card>
          <Tabs tabs={tabs} variant="underline" defaultValue="general" />
        </Card>
      </div>
    </MainLayout>
  );
}
