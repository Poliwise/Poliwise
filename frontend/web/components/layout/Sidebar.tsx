'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  User,
  X,
  ChevronLeft,
  LogOut,
  Shield,
  FileText,
  Users,
  Tags,
  Brain,
  LayoutDashboard,
} from 'lucide-react';
import { useAuthStore, useUserRole } from '@/store';
import { UserRole } from '@/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    label: 'Hỏi đáp AI',
    href: '/',
    icon: <MessageSquare size={20} />,
  },
  {
    label: 'Tài liệu',
    href: '/documents',
    icon: <BookOpen size={20} />,
  },
  {
    label: 'Báo cáo phân tích',
    href: '/analytics',
    icon: <BarChart3 size={20} />,
    roles: [UserRole.MANAGER, UserRole.ADMIN],
  },
];

const adminItems: NavItem[] = [
  {
    label: 'Quản lý tài liệu',
    href: '/admin/documents',
    icon: <FileText size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Quản lý người dùng',
    href: '/admin/users',
    icon: <Users size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Quản lý metadata',
    href: '/admin/metadata',
    icon: <Tags size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Câu hỏi chưa trả lời',
    href: '/admin/unanswered',
    icon: <Brain size={20} />,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const userRole = useUserRole();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole as UserRole)
  );

  const filteredAdminItems = adminItems.filter(
    (item) => !item.roles || item.roles.includes(userRole as UserRole)
  );

  const handleLogout = () => {
    useAuthStore.getState().logout();
    onClose();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Menu</span>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Chính</span>
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${
                  pathname === item.href ? styles.active : ''
                }`}
                onClick={onClose}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {filteredAdminItems.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>
                <Shield size={14} />
                Quản trị
              </span>
              {filteredAdminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${
                    pathname === item.href ? styles.active : ''
                  }`}
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className={styles.footer}>
          <Link
            href="/profile"
            className={styles.navItem}
            onClick={onClose}
          >
            <User size={20} />
            <span>Trang cá nhân</span>
          </Link>
          <Link
            href="/settings"
            className={styles.navItem}
            onClick={onClose}
          >
            <Settings size={20} />
            <span>Cài đặt</span>
          </Link>
          <button
            className={styles.navItem}
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
