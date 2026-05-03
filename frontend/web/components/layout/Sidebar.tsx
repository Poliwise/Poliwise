'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  FileText,
  Users,
  Tags,
  FolderOpen,
  Shield,
  FileBarChart,
  ScrollText,
  Brain,
  Settings,
  User,
  X,
  LogOut,
  Building2,
} from 'lucide-react';
import { useUserRole, useAuthStore } from '@/store';
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
  dividerBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
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

const ADMIN_ITEMS: NavItem[] = [
  {
    label: 'Quản lý người dùng',
    href: '/admin/users',
    icon: <Users size={20} />,
    roles: [UserRole.ADMIN],
    dividerBefore: true,
  },
  {
    label: 'Phòng ban',
    href: '/admin/departments',
    icon: <Building2 size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Danh mục',
    href: '/admin/metadata/categories',
    icon: <FolderOpen size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Nhãn',
    href: '/admin/metadata/tags',
    icon: <Tags size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Quyền truy cập',
    href: '/admin/access-rules',
    icon: <Shield size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: 'Nhật ký hệ thống',
    href: '/admin/audit-logs',
    icon: <ScrollText size={20} />,
    roles: [UserRole.ADMIN],
    dividerBefore: true,
  },
  {
    label: 'Câu hỏi chưa trả lời',
    href: '/admin/unanswered',
    icon: <Brain size={20} />,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    dividerBefore: true,
  },
  {
    label: 'Xuất báo cáo',
    href: '/analytics/reports',
    icon: <FileBarChart size={20} />,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const userRole = useUserRole();

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(userRole as UserRole));

  const filteredNav = filterByRole(NAV_ITEMS);
  const filteredAdmin = filterByRole(ADMIN_ITEMS);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    onClose();
    window.location.href = '/login';
  };

  const renderNavItem = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
      onClick={onClose}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );

  return (
    <>
      {isOpen && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Menu</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close sidebar">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {/* Main navigation */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Chính</span>
            {filteredNav.map(renderNavItem)}
          </div>

          {/* Admin section */}
          {filteredAdmin.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>
                <Shield size={14} />
                Quản trị
              </span>
              {filteredAdmin.map((item) => (
                <div key={item.href}>
                  {item.dividerBefore && <div className={styles.divider} />}
                  {renderNavItem(item)}
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          <Link href="/profile" className={styles.navItem} onClick={onClose}>
            <User size={20} />
            <span>Trang cá nhân</span>
          </Link>
          <Link href="/admin/settings" className={styles.navItem} onClick={onClose}>
            <Settings size={20} />
            <span>Cài đặt</span>
          </Link>
          <button className={styles.navItem} onClick={handleLogout}>
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
