'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Tag as TagIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { tagService } from '@/services/document.service';
import type { Tag } from '@/types/document';
import { IconPicker, getIconByName } from '@/components/common/IconPicker';
import { useLanguage } from '@/providers';
import { Translator } from '@/lib/i18n';

export default function TagsPage() {
  const { t } = useLanguage();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    setFilteredTags(
      tags.filter((tag) =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [searchQuery, tags]);

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await tagService.getTags();
      setTags(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!confirm(t('admin.tags.confirm.delete').replace('{name}', tag.name))) return;
    try {
      await tagService.deleteTag(tag.id);
      loadTags();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingTag(null);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    setEditingTag(null);
    loadTags();
  };

  const getTagColor = (color: string | undefined) => {
    return color || '#6366f1';
  };

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
              <h1 className="text-2xl font-bold text-gray-900">{t('admin.tags.title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('admin.tags.count').replace('{count}', String(tags.length))}
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('admin.tags.add')}
            </button>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.tags.search.placeholder')}
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

        <div className="bg-white shadow rounded-lg p-6">
          {filteredTags.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <TagIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>{t('admin.tags.empty')}</p>
              <button
                onClick={handleCreate}
                className="mt-4 text-indigo-600 hover:text-indigo-800"
              >
                {t('admin.tags.empty.start')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 group"
                  style={{
                    backgroundColor: `${getTagColor(tag.color)}10`,
                    borderColor: `${getTagColor(tag.color)}30`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: getTagColor(tag.color) }}
                  />
                  {tag.icon ? (
                    <div className="mr-1.5" style={{ color: getTagColor(tag.color) }}>
                      {getIconByName(tag.icon, 14)}
                    </div>
                  ) : null}
                  <span
                    className="text-sm font-medium"
                    style={{ color: getTagColor(tag.color) }}
                  >
                    {tag.name}
                  </span>
                  {tag.usageCount !== undefined && tag.usageCount > 0 && (
                    <span className="ml-1.5 text-xs text-gray-500">
                      ({tag.usageCount})
                    </span>
                  )}
                  <div className="ml-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <TagModal
          tag={editingTag}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          t={t}
        />
      )}
    </div>
  );
}

// Tag Modal
function TagModal({
  tag,
  onClose,
  onSuccess,
  t,
}: {
  tag: Tag | null;
  onClose: () => void;
  onSuccess: () => void;
  t: Translator;
}) {
  const [formData, setFormData] = useState({
    name: tag?.name || '',
    color: tag?.color || '#6366f1',
    icon: tag?.icon || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (tag) {
        await tagService.updateTag(tag.id, formData);
      } else {
        await tagService.createTag(formData);
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {tag ? t('admin.tags.modal.edit') : t('admin.tags.modal.create')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.tags.modal.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                placeholder={t('admin.tags.modal.name.placeholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.tags.modal.color')}</label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      formData.color === color
                        ? 'border-gray-900 scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <IconPicker
              label="Icon"
              value={formData.icon}
              onChange={(icon) => setFormData({ ...formData, icon })}
            />
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
                {t('admin.tags.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? t('admin.tags.modal.saving') : t('admin.tags.modal.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
