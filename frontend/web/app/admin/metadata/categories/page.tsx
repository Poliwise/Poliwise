'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Search,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react';
import {
  categoryService,
} from '@/services/document.service';
import type { Category, CategoryTree } from '@/types/document';
import { IconPicker, getIconByName } from '@/components/common/IconPicker';
import { useLanguage } from '@/providers';
import { Translator } from '@/lib/i18n';

export default function CategoriesPage() {
  const { t } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const [cats, tree] = await Promise.all([
        categoryService.getCategories(),
        categoryService.getCategoryTree(),
      ]);
      setCategories(cats);
      setCategoryTree(tree);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(t('admin.categories.confirm.delete').replace('{name}', category.name))) return;
    try {
      await categoryService.deleteCategory(category.id);
      loadCategories();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    setEditingCategory(null);
    loadCategories();
  };

  const filteredTree = searchQuery
    ? flattenTree(categoryTree).filter(
        (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categoryTree;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('admin.categories.title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('admin.categories.count').replace('{count}', String(categories.length))}
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('admin.categories.add')}
            </button>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.categories.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {filteredTree.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>{t('admin.categories.empty')}</p>
              <button
                onClick={handleCreate}
                className="mt-4 text-indigo-600 hover:text-indigo-800"
              >
                {t('admin.categories.empty.start')}
              </button>
            </div>
          ) : searchQuery ? (
            // Search results (flat list)
            <div className="divide-y divide-gray-200">
              {filteredTree.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <FolderOpen className="w-5 h-5 text-indigo-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500">{cat.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-2 text-gray-400 hover:text-indigo-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Tree view
            <div className="divide-y divide-gray-200">
              {categoryTree.map((cat) => (
                <CategoryTreeItem
                  key={cat.id}
                  category={cat}
                  expandedIds={expandedIds}
                  onToggle={toggleExpanded}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <CategoryModal
          category={editingCategory}
          categories={categories.filter((c) => c.id !== editingCategory?.id)}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          t={t}
        />
      )}
    </div>
  );
}

function CategoryTreeItem({
  category,
  expandedIds,
  onToggle,
  onEdit,
  onDelete,
}: {
  category: CategoryTree;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);

  return (
    <>
      <div className="p-4 flex items-center hover:bg-gray-50">
        <button
          onClick={() => hasChildren && onToggle(category.id)}
          className={`p-1 mr-2 ${hasChildren ? 'text-gray-400 hover:text-gray-600' : 'text-transparent'}`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {category.icon ? (
          <div className="w-5 h-5 mr-3 text-indigo-500 flex items-center justify-center">
            {getIconByName(category.icon, 20)}
          </div>
        ) : (
          <FolderOpen className="w-5 h-5 text-indigo-500 mr-3" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{category.name}</p>
          <p className="text-xs text-gray-500">{category.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(category as unknown as Category)}
            className="p-2 text-gray-400 hover:text-indigo-600"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(category as unknown as Category)}
            className="p-2 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="bg-gray-50 border-l-4 border-indigo-200">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}

function flattenTree(tree: CategoryTree[]): CategoryTree[] {
  const result: CategoryTree[] = [];
  for (const cat of tree) {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenTree(cat.children));
    }
  }
  return result;
}

// Category Modal
function CategoryModal({
  category,
  categories,
  onClose,
  onSuccess,
  t,
}: {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
  t: Translator;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    parentId: category?.parentId || '',
    icon: category?.icon || '',
    displayOrder: category?.displayOrder || 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (category) {
        await categoryService.updateCategory(category.id, formData);
      } else {
        await categoryService.createCategory(formData);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {category ? t('admin.categories.modal.edit') : t('admin.categories.modal.create')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.categories.modal.name.required')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.categories.modal.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.categories.modal.parent')}</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t('admin.categories.modal.parent.none')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <IconPicker
                label={t('admin.categories.modal.icon')}
                value={formData.icon}
                onChange={(icon) => setFormData({ ...formData, icon })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.categories.modal.order')}</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('admin.categories.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? t('admin.categories.modal.saving') : t('admin.categories.modal.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
