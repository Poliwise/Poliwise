'use client';

import React from 'react';
import {
  Building2,
  Users,
} from 'lucide-react';
import {
  Card,
  PageHeader,
} from '@/components/ui';
import styles from './departments.module.css';

const DEPARTMENTS = [
  { id: '1', name: 'Kỹ thuật', code: 'ENGINEER', employeeCount: 24 },
  { id: '2', name: 'Marketing', code: 'MARKETING', employeeCount: 12 },
  { id: '3', name: 'Kinh doanh', code: 'SALES', employeeCount: 18 },
  { id: '4', name: 'Nhân sự', code: 'HR', employeeCount: 8 },
  { id: '5', name: 'Tài chính', code: 'FINANCE', employeeCount: 6 },
  { id: '6', name: 'Vận hành', code: 'OPERATIONS', employeeCount: 15 },
  { id: '7', name: 'Pháp lý', code: 'LEGAL', employeeCount: 5 },
];

export default function DepartmentsPage() {
  return (
    <div className={styles.container}>
      <PageHeader
        title="Phòng ban"
        description="Danh sách các phòng ban trong hệ thống."
      />

      <div className={styles.grid}>
        {DEPARTMENTS.map((dept) => (
          <Card key={dept.id} padding="md">
            <div className={styles.deptCard}>
              <div className={styles.deptIcon}>
                <Building2 size={22} />
              </div>
              <div className={styles.deptInfo}>
                <h3 className={styles.deptName}>{dept.name}</h3>
                <code className={styles.deptCode}>{dept.code}</code>
              </div>
              <div className={styles.deptMeta}>
                <Users size={14} />
                <span>{dept.employeeCount} nhân viên</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
