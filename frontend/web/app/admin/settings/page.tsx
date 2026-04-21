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
import styles from './settings.module.css';

const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Notification preferences
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifUnanswered, setNotifUnanswered] = useState(true);
  const [notifReport, setNotifReport] = useState(false);

  // System preferences
  const [language, setLanguage] = useState('vi');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [darkMode, setDarkMode] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    {
      value: 'general',
      label: 'Chung',
      icon: <Globe size={16} />,
      content: (
        <div className={styles.settingsSection}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Ngôn ngữ</h3>
              <p>Chọn ngôn ngữ hiển thị cho giao diện</p>
            </div>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={LANGUAGE_OPTIONS}
              selectSize="sm"
              className={styles.settingSelect}
            />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Múi giờ</h3>
              <p>Đặt múi giờ cho các báo cáo và thống kê</p>
            </div>
            <Select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={TIMEZONE_OPTIONS}
              selectSize="sm"
              className={styles.settingSelect}
            />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Giao diện tối</h3>
              <p>Bật chế độ tối cho toàn bộ ứng dụng</p>
            </div>
            <Switch checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
          </div>
        </div>
      ),
    },
    {
      value: 'notifications',
      label: 'Thông báo',
      icon: <Bell size={16} />,
      content: (
        <div className={styles.settingsSection}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Email thông báo</h3>
              <p>Nhận thông báo qua email về các hoạt động quan trọng</p>
            </div>
            <Switch checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Câu hỏi chưa trả lời</h3>
              <p>Thông báo khi có câu hỏi mới chưa được trả lời</p>
            </div>
            <Switch checked={notifUnanswered} onChange={(e) => setNotifUnanswered(e.target.checked)} />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Báo cáo hoàn thành</h3>
              <p>Thông báo khi báo cáo đã được tạo xong</p>
            </div>
            <Switch checked={notifReport} onChange={(e) => setNotifReport(e.target.checked)} />
          </div>
        </div>
      ),
    },
    {
      value: 'security',
      label: 'Bảo mật',
      icon: <Shield size={16} />,
      content: (
        <div className={styles.settingsSection}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Đổi mật khẩu</h3>
              <p>Thay đổi mật khẩu định kỳ để bảo vệ tài khoản</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<KeyRound size={16} />}
              onClick={() => router.push('/profile/change-password')}
            >
              Đổi mật khẩu
            </Button>
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <h3>Phiên đăng nhập</h3>
              <p>Xem và quản lý các thiết bị đang đăng nhập</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Clock size={16} />}
              onClick={() => router.push('/profile/sessions')}
            >
              Quản lý phiên
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Cài đặt</h1>
          <p>Quản lý cấu hình và tùy chọn hệ thống</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={16} />}
          loading={saving}
          onClick={handleSave}
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>

      {saved && (
        <div className={styles.savedBanner}>
          <RefreshCw size={16} />
          <span>Đã lưu cài đặt thành công!</span>
        </div>
      )}

      <Card>
        <Tabs tabs={tabs} variant="underline" defaultValue="general" />
      </Card>
    </div>
  );
}
