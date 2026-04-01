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
import { useAuthStore, useUserRole, useIsManager } from '@/store';
import { api } from '@/lib/api';
import { UserRole } from '@/types';
import styles from './Header.module.css';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isManager = useIsManager();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore errors
    }
    logout();
    window.location.href = '/login';
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return { label: 'Admin', className: 'bg-red-100 text-red-700' };
      case UserRole.MANAGER:
        return { label: 'Manager', className: 'bg-blue-100 text-blue-700' };
      default:
        return { label: 'User', className: 'bg-green-100 text-green-700' };
    }
  };

  const roleBadge = user?.role ? getRoleBadge(user.role) : null;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuButton}
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
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
        {user && (
          <div className={styles.userMenu}>
            <button
              className={styles.userButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className={styles.avatar}>
                <User size={18} />
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.username}</span>
                {roleBadge && (
                  <span className={`${styles.roleBadge} ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                )}
              </div>
              <ChevronDown size={16} className={styles.chevron} />
            </button>

            {showUserMenu && (
              <div className={styles.dropdown}>
                <Link href="/profile" className={styles.dropdownItem}>
                  <User size={16} />
                  <span>Trang cá nhân</span>
                </Link>

                {user.role === UserRole.ADMIN && (
                  <Link href="/admin" className={styles.dropdownItem}>
                    <Shield size={16} />
                    <span>Quản trị</span>
                  </Link>
                )}

                <Link href="/settings" className={styles.dropdownItem}>
                  <Settings size={16} />
                  <span>Cài đặt</span>
                </Link>

                <div className={styles.divider} />

                <button onClick={handleLogout} className={styles.dropdownItem}>
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        )}

        {!user && (
          <Link href="/login" className={styles.loginButton}>
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
