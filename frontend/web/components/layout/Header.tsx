'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  User,
  LogOut,
  Menu,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { useAuthStore, useIsManager } from '@/store';
import { api } from '@/lib/api';
import { UserRole } from '@/types';
import styles from './Header.module.css';

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  [UserRole.ADMIN]: styles.roleAdmin,
  [UserRole.MANAGER]: styles.roleManager,
  [UserRole.USER]: styles.roleUser,
};

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.MANAGER]: 'Manager',
  [UserRole.USER]: 'User',
};

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isManager = useIsManager();

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await api.auth.logout();
    } catch { /* ignore */ }
    logout();
    window.location.href = '/login';
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.menuButton} onClick={onMenuClick} aria-label="Toggle menu">
          <Menu size={20} />
        </button>

        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <MessageSquare size={24} />
          </div>
          <span className={styles.logoText}>Poliwise</span>
        </Link>
      </div>

      <nav className={styles.nav}>
        <Link
          href="/"
          className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
        >
          <MessageSquare size={18} />
          <span>Hỏi đáp</span>
        </Link>

        <Link
          href="/documents"
          className={`${styles.navLink} ${pathname === '/documents' ? styles.active : ''}`}
        >
          <BookOpen size={18} />
          <span>Tài liệu</span>
        </Link>

        {isManager && (
          <Link
            href="/analytics"
            className={`${styles.navLink} ${pathname === '/analytics' ? styles.active : ''}`}
          >
            <BarChart3 size={18} />
            <span>Phân tích</span>
          </Link>
        )}
      </nav>

      <div className={styles.right}>
        {user ? (
          <div className={styles.userMenu}>
            <button
              className={styles.userButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className={styles.avatar}>
                <User size={16} />
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.username}</span>
                {user.role && (
                  <span className={`${styles.roleBadge} ${ROLE_BADGE_CLASS[user.role]}`}>
                    {ROLE_LABEL[user.role]}
                  </span>
                )}
              </div>
              <ChevronDown size={16} className={styles.chevron} />
            </button>

            {showUserMenu && (
              <div className={styles.dropdown}>
                <Link href="/profile" className={styles.dropdownItem} onClick={() => setShowUserMenu(false)}>
                  <User size={16} />
                  <span>Trang cá nhân</span>
                </Link>

                {user.role === UserRole.ADMIN && (
                  <Link href="/admin/settings" className={styles.dropdownItem} onClick={() => setShowUserMenu(false)}>
                    <Settings size={16} />
                    <span>Cài đặt</span>
                  </Link>
                )}

                {user.role === UserRole.ADMIN && (
                  <Link href="/admin" className={styles.dropdownItem} onClick={() => setShowUserMenu(false)}>
                    <Shield size={16} />
                    <span>Quản trị</span>
                  </Link>
                )}

                <div className={styles.divider} />

                <button onClick={handleLogout} className={styles.dropdownItem}>
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className={styles.loginButton}>
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
