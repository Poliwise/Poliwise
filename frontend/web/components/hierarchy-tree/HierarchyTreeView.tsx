'use client';

import React, { useCallback, useMemo } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Users,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CornerDownRight,
} from 'lucide-react';
import type { Department, DepartmentTreeNode } from '@/types';
import styles from './HierarchyTree.module.css';

// ============================================================================
// Types
// ============================================================================

export interface HierarchyNodeData {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  description?: string;
  userCount?: number;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  children?: HierarchyNodeData[];
}

export interface HierarchyTreeProps {
  /** Flat tree data from API */
  nodes: DepartmentTreeNode[];
  /** Currently expanded node IDs */
  expanded: Set<string>;
  /** Callback when expand/collapse toggle is clicked */
  onToggle: (id: string) => void;
  /** Callback when expand-all / collapse-all is triggered */
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  /** Optional click handlers */
  onEdit?: (dept: Department) => void;
  onDelete?: (dept: Department) => void;
  onToggleActive?: (dept: Department, e: React.MouseEvent) => void;
  onViewUsers?: (dept: Department) => void;
  /** Optional extra actions per node */
  renderNodeActions?: (dept: Department) => React.ReactNode;
  /** Whether all nodes are currently expanded */
  allExpanded?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function flattenTree(
  nodes: DepartmentTreeNode[],
  expanded: Set<string>,
  depth = 0
): Array<{ node: DepartmentTreeNode; depth: number; isExpanded: boolean }> {
  const result: Array<{ node: DepartmentTreeNode; depth: number; isExpanded: boolean }> = [];
  for (const node of nodes) {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    result.push({ node, depth, isExpanded: expanded.has(node.id) });
    if (hasChildren && expanded.has(node.id) && node.children) {
      result.push(...flattenTree(node.children, expanded, depth + 1));
    }
  }
  return result;
}

function collectAllIds(nodes: DepartmentTreeNode[], ids = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      ids.add(node.id);
      collectAllIds(node.children, ids);
    }
  }
  return ids;
}

function countDescendants(node: DepartmentTreeNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

// ============================================================================
// TreeNode Component
// ============================================================================

interface TreeNodeProps {
  data: { node: DepartmentTreeNode; depth: number; isExpanded: boolean };
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit?: (dept: Department) => void;
  onDelete?: (dept: Department) => void;
  onToggleActive?: (dept: Department, e: React.MouseEvent) => void;
  onViewUsers?: (dept: Department) => void;
  renderNodeActions?: (dept: Department) => React.ReactNode;
}

function toFlatDept(node: DepartmentTreeNode): Department {
  return {
    id: node.id,
    name: node.name,
    code: node.code,
    isActive: node.isActive ?? true,
    description: node.description,
    parent: node.parent,
    userCount: node.userCount ?? 0,
    children: node.children,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  } as Department;
}

function TreeNode({
  data,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onToggleActive,
  onViewUsers,
  renderNodeActions,
}: TreeNodeProps) {
  const { node, depth, isExpanded } = data;
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const dept = toFlatDept(node);
  const isRoot = depth === 0;

  return (
    <div
      className={`${styles.nodeWrapper} ${isRoot ? styles.rootNode : styles.childNode}`}
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div
        className={`${styles.nodeRow} ${!node.isActive ? styles.inactive : ''}`}
      >
        {/* Tree line indicator */}
        <div className={styles.treeLine}>
          {depth > 0 && <CornerDownRight size={14} className={styles.connectorIcon} />}
        </div>

        {/* Expand toggle */}
        <button
          className={`${styles.toggleBtn} ${hasChildren ? styles.hasChildren : ''} ${isExpanded ? styles.expanded : ''}`}
          onClick={() => hasChildren && onToggle(node.id)}
          title={hasChildren ? (isExpanded ? 'Thu gọn' : 'Mở rộng') : undefined}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : null}
        </button>

        {/* Department icon */}
        <div className={`${styles.deptIcon} ${!node.isActive ? styles.inactiveIcon : isRoot ? styles.rootIcon : styles.childIcon}`}>
          <Building2 size={isRoot ? 16 : 14} />
        </div>

        {/* Info */}
        <div className={styles.nodeInfo}>
          <div className={styles.nodeNameRow}>
            <span className={`${styles.nodeName} ${!node.isActive ? styles.inactiveText : ''}`}>
              {node.name}
            </span>
            {node.code && (
              <span className={styles.nodeCode}>{node.code}</span>
            )}
            {hasChildren && (() => {
              const total = countDescendants(node);
              return total > 0 ? (
                <span className={`${styles.childBadge} ${isExpanded ? styles.childBadgeExpanded : ''}`}>
                  {total} {total === 1 ? 'phòng con' : 'phòng ban con'}
                </span>
              ) : null;
            })()}
          </div>
          {node.description && (
            <p className={styles.nodeDesc}>{node.description}</p>
          )}
        </div>

        {/* Status dot */}
        <div className={`${styles.statusDot} ${node.isActive ? styles.active : styles.inactiveDot}`} />

        {/* Actions */}
        <div className={styles.nodeActions}>
          {onToggleActive && (
            <button
              className={`${styles.actionBtn} ${node.isActive ? styles.actionSuccess : ''}`}
              onClick={(e) => onToggleActive(dept, e)}
              title={node.isActive ? 'Tắt hoạt động' : 'Bật hoạt động'}
            >
              {node.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            </button>
          )}
          {onViewUsers && (
            <button
              className={styles.actionBtn}
              onClick={() => onViewUsers(dept)}
              title="Xem nhân viên"
            >
              <Users size={14} />
            </button>
          )}
          {onEdit && (
            <button
              className={styles.actionBtn}
              onClick={() => onEdit(dept)}
              title="Chỉnh sửa"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              className={`${styles.actionBtn} ${styles.actionDanger}`}
              onClick={() => onDelete(dept)}
              title="Xóa"
              disabled={(node.userCount ?? 0) > 0}
            >
              <Trash2 size={14} />
            </button>
          )}
          {renderNodeActions && renderNodeActions(dept)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HierarchyTreeView({
  nodes,
  expanded,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onEdit,
  onDelete,
  onToggleActive,
  onViewUsers,
  renderNodeActions,
}: HierarchyTreeProps) {
  const allIds = useMemo(() => collectAllIds(nodes), [nodes]);

  const handleExpandAll = useCallback(() => {
    if (onExpandAll) {
      onExpandAll();
    } else {
      allIds.forEach((id) => {
        if (!expanded.has(id)) onToggle(id);
      });
    }
  }, [allIds, expanded, onToggle, onExpandAll]);

  const handleCollapseAll = useCallback(() => {
    if (onCollapseAll) {
      onCollapseAll();
    } else {
      allIds.forEach((id) => {
        if (expanded.has(id)) onToggle(id);
      });
    }
  }, [allIds, expanded, onToggle, onCollapseAll]);

  const flatNodes = useMemo(
    () => flattenTree(nodes, expanded),
    [nodes, expanded]
  );

  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <Building2 size={40} />
        <p>Không có phòng ban nào</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>
          <CornerDownRight size={14} />
          Cây phân cấp tổ chức
        </span>
        <div className={styles.toolbarActions}>
          <button
            className={styles.toolbarBtn}
            onClick={handleExpandAll}
            title="Mở rộng tất cả"
          >
            <ChevronsUpDown size={14} />
            Mở rộng tất cả
          </button>
          <button
            className={styles.toolbarBtn}
            onClick={handleCollapseAll}
            title="Thu gọn tất cả"
          >
            <ChevronsDownUp size={14} />
            Thu gọn tất cả
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className={styles.tree}>
        {flatNodes.map((item) => (
          <TreeNode
            key={item.node.id}
            data={item}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            onViewUsers={onViewUsers}
            renderNodeActions={renderNodeActions}
          />
        ))}
      </div>
    </div>
  );
}

export default HierarchyTreeView;
