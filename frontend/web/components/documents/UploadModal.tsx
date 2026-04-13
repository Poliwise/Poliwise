'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { DocumentUploadResponse } from '@/types';
import { TagInput } from './TagInput';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'select' | 'review' | 'done';

interface Category {
  id: string;
  name: string;
  slug: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Step 1: File selection
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Step 2: Metadata review
  const [step, setStep] = useState<Step>('select');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPolicy, setIsPolicy] = useState(false);
  const [language, setLanguage] = useState('vi');

  // Categories for dropdown
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const hasFetchedCategories = useRef(false);

  // Loading / error states
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [aiSuggestionAvailable, setAiSuggestionAvailable] = useState<boolean | null>(null);

  // Success state
  const [uploadedDoc, setUploadedDoc] = useState<DocumentUploadResponse | null>(null);

  // Fetch categories on open
  useEffect(() => {
    if (isOpen && categories.length === 0 && !categoriesLoading && !categoriesError && !hasFetchedCategories.current) {
      setCategoriesLoading(true);
      setCategoriesError(null);
      hasFetchedCategories.current = true;
      api.metadata.getCategories()
        .then((cats) => {
          setCategories(cats);
          setCategoriesError(null);
        })
        .catch(() => {
          setCategoriesError('Không thể tải danh sách danh mục');
          hasFetchedCategories.current = false;
        })
        .finally(() => setCategoriesLoading(false));
    }
  }, [isOpen, categories.length, categoriesLoading, categoriesError]);

  // Re-evaluate category pre-selection once categories are loaded
  useEffect(() => {
    if (categories.length > 0 && uploadedDoc?.suggestedCategorySlug && step === 'review') {
      const hasMatchingCategory = categories.some(c => c.slug === uploadedDoc.suggestedCategorySlug);
      if (hasMatchingCategory) {
        setCategorySlug(uploadedDoc.suggestedCategorySlug);
      } else if (categorySlug === 'none') {
        // Already set to none, no change needed
      } else {
        setCategorySlug('none');
      }
    }
  }, [categories, uploadedDoc?.suggestedCategorySlug, step]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setCategorySlug('none');
      setTags([]);
      setIsPolicy(false);
      setLanguage('vi');
      setUploading(false);
      setError(null);
      setRetryCount(0);
      setAiSuggestionAvailable(null);
      setUploadedDoc(null);
      // Don't reset categories - keep them cached for next open
      setCategoriesLoading(false);
      setCategoriesError(null);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    window.addEventListener('keydown', handler as any);
    return () => window.removeEventListener('keydown', handler as any);
  }, [isOpen, uploadedDoc, step]);

  const handleClose = useCallback(async () => {
    // If we're in review step and have an uploaded doc, cancel it first
    if (step === 'review' && uploadedDoc?.id) {
      setCancelling(true);
      try {
        await api.documents.cancel(uploadedDoc.id);
      } catch (err) {
        console.error('Failed to cancel upload:', err);
      } finally {
        setCancelling(false);
      }
    }
    onClose();
  }, [step, uploadedDoc, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleUpload = useCallback(async (retry = false) => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const response = await api.documents.upload(selectedFile);

      // Check if AI suggestion was successful
      const hasSuggestion = !!(
        response.suggestedTitle ||
        response.suggestedDescription ||
        response.suggestedCategorySlug ||
        response.suggestedLanguage ||
        (response.suggestedTags && response.suggestedTags.length > 0)
      );

      setAiSuggestionAvailable(hasSuggestion);

      if (hasSuggestion) {
        // AI succeeded — pre-fill fields
        setTitle(response.suggestedTitle || '');
        setDescription(response.suggestedDescription || '');
        setTags(response.suggestedTags || []);
        setIsPolicy(response.suggestedIsPolicy || false);
        const lang = (response.suggestedLanguage || 'vi').trim().toLowerCase();
        setLanguage(lang.startsWith('en') ? 'en' : 'vi');

        // Pre-select category if it exists in fetched list, otherwise "none"
        const suggestedSlug = response.suggestedCategorySlug;
        const hasMatchingCategory = categories.some(c => c.slug === suggestedSlug);
        setCategorySlug(suggestedSlug && hasMatchingCategory ? suggestedSlug : 'none');

        setUploadedDoc(response);
      } else {
        // AI failed — show empty form with retry option
        setTitle('');
        setDescription('');
        setCategorySlug('none');
        setTags([]);
        setIsPolicy(false);
        setLanguage('vi');
        setUploadedDoc(response);
      }

      setStep('review');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Có lỗi xảy ra khi tải lên';
      setError(msg);
      if (retry) {
        setRetryCount((c) => c + 1);
      }
    } finally {
      setUploading(false);
    }
  }, [selectedFile]);

  const handleRetry = useCallback(() => {
    handleUpload(true);
  }, [handleUpload]);

  const handleConfirm = useCallback(async () => {
    if (!uploadedDoc?.id) return;

    setConfirming(true);
    setError(null);

    try {
      await api.documents.confirmMetadata(uploadedDoc.id, {
        title,
        description,
        categorySlug,
        tags,
        language,
        isPolicy,
      });

      setStep('done');
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Có lỗi xảy ra khi xác nhận metadata';
      setError(msg);
    } finally {
      setConfirming(false);
    }
  }, [uploadedDoc, title, description, categorySlug, tags, language, isPolicy, onSuccess]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="upload-modal-overlay" onClick={handleClose}>
      <div className="upload-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="upload-modal-header">
          <h2 className="upload-modal-title">
            {step === 'select' && 'Tải tài liệu lên'}
            {step === 'review' && (aiSuggestionAvailable ? 'Xem xét metadata gợi ý' : 'Nhập metadata')}
            {step === 'done' && 'Thành công'}
          </h2>
          <button className="upload-modal-close" onClick={handleClose} disabled={cancelling}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="upload-modal-body">
          {/* ── STEP 1: File Selection ─────────────────────────────── */}
          {step === 'select' && (
            <div className="upload-step">
              {/* Drop zone */}
              <div
                className={`upload-dropzone ${selectedFile ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {selectedFile ? (
                  <div className="upload-file-info">
                    <FileText size={32} className="upload-file-icon" />
                    <div>
                      <p className="upload-file-name">{selectedFile.name}</p>
                      <p className="upload-file-size">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="upload-dropzone-icon" />
                    <p className="upload-dropzone-text">Kéo thả file vào đây, hoặc</p>
                    <label className="upload-dropzone-btn">
                      Chọn file
                      <input type="file" onChange={handleFileChange} hidden />
                    </label>
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="upload-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <div className="upload-modal-actions">
                <button className="upload-modal-btn secondary" onClick={handleClose}>
                  Hủy
                </button>
                <button
                  className="upload-modal-btn primary"
                  disabled={!selectedFile || uploading}
                  onClick={() => handleUpload(false)}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    'Tiếp tục'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Metadata Review / Manual Entry ─────────────── */}
          {step === 'review' && (
            <div className="upload-step">
              {/* AI failure banner */}
              {!aiSuggestionAvailable && (
                <div className="upload-warning-banner">
                  <AlertTriangle size={18} />
                  <div>
                    <p className="upload-warning-title">Không thể tự động gợi ý metadata</p>
                    <p className="upload-warning-text">
                      Vui lòng nhập thủ công hoặc thử lại.
                    </p>
                  </div>
                </div>
              )}

              {/* Retry / Manual options when AI failed */}
              {!aiSuggestionAvailable && retryCount < 2 && (
                <div className="upload-retry-bar">
                  <button
                    className="upload-modal-btn secondary"
                    onClick={handleRetry}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Đang thử lại...
                      </>
                    ) : (
                      'Thử lại'
                    )}
                  </button>
                  <span className="upload-retry-hint">
                    hoặc nhập thông tin bên dưới
                  </span>
                </div>
              )}
              {!aiSuggestionAvailable && retryCount >= 2 && (
                <div className="upload-error">
                  <AlertCircle size={16} />
                  <span>Đã thử lại nhưng không thành công. Vui lòng nhập thủ công.</span>
                </div>
              )}

              {/* Form fields */}
              <div className="upload-field">
                <label className="upload-field-label">Tiêu đề</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề..."
                  className="upload-field-input"
                  autoFocus
                />
              </div>

              <div className="upload-field">
                <label className="upload-field-label">Mô tả</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn về tài liệu..."
                  className="upload-field-textarea"
                  rows={3}
                />
              </div>

              <div className="upload-field">
                <label className="upload-field-label">Danh mục</label>
                {categoriesLoading ? (
                  <div className="upload-field-loading">
                    <Loader2 size={14} className="spin" />
                    <span>Đang tải danh mục...</span>
                  </div>
                ) : categoriesError ? (
                  <div className="upload-field-error">
                    <AlertCircle size={14} />
                    <span>{categoriesError}</span>
                  </div>
                ) : (
                  <select
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    className="upload-field-select"
                  >
                    <option value="none">Không có (None)</option>
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="upload-field">
                <label className="upload-field-label">Tags</label>
                <TagInput value={tags} onChange={setTags} placeholder="Thêm tag rồi nhấn Enter..." />
              </div>

              <div className="upload-field">
                <label className="upload-field-label">Ngôn ngữ</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="upload-field-select"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="upload-field upload-field-checkbox">
                <input
                  type="checkbox"
                  id="isPolicy"
                  checked={isPolicy}
                  onChange={(e) => setIsPolicy(e.target.checked)}
                />
                <label htmlFor="isPolicy">Là tài liệu chính sách/quy định</label>
              </div>

              {/* Error */}
              {error && (
                <div className="upload-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="upload-modal-actions">
                <button className="upload-modal-btn secondary" onClick={handleClose} disabled={cancelling}>
                  {cancelling ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Đang hủy...
                    </>
                  ) : (
                    'Hủy'
                  )}
                </button>
                <button
                  className="upload-modal-btn primary"
                  onClick={handleConfirm}
                  disabled={confirming || !title.trim()}
                >
                  {confirming ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Đang xác nhận...
                    </>
                  ) : (
                    'Xác nhận'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success ────────────────────────────────────── */}
          {step === 'done' && (
            <div className="upload-step upload-success">
              <CheckCircle size={48} className="upload-success-icon" />
              <h3>Tải lên thành công!</h3>
              <p className="upload-success-filename">{selectedFile?.name}</p>
              <div className="upload-modal-actions">
                <button className="upload-modal-btn primary" onClick={handleClose}>
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline styles */}
      <style>{`
        .upload-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .upload-modal-content {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.2s ease-out;
        }
        .upload-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .upload-modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--foreground);
          margin: 0;
        }
        .upload-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border: none;
          background: none;
          color: var(--muted-foreground);
          cursor: pointer;
          border-radius: 0.375rem;
          transition: all 0.15s;
        }
        .upload-modal-close:hover {
          background: var(--muted);
          color: var(--foreground);
        }
        .upload-modal-body {
          padding: 1.5rem;
        }
        .upload-step {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .upload-dropzone {
          border: 2px dashed var(--border);
          border-radius: 0.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          transition: all 0.2s;
          cursor: pointer;
          text-align: center;
        }
        .upload-dropzone:hover {
          border-color: var(--primary);
          background: rgba(79, 70, 229, 0.03);
        }
        .upload-dropzone.has-file {
          border-style: solid;
          border-color: var(--primary);
          background: rgba(79, 70, 229, 0.05);
          cursor: default;
        }
        .upload-dropzone-icon {
          color: var(--muted-foreground);
        }
        .upload-dropzone-text {
          font-size: 0.9375rem;
          color: var(--muted-foreground);
          margin: 0;
        }
        .upload-dropzone-btn {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: var(--primary);
          color: var(--primary-foreground);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .upload-dropzone-btn:hover {
          opacity: 0.9;
        }
        .upload-file-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .upload-file-icon {
          color: var(--primary);
        }
        .upload-file-name {
          font-weight: 500;
          color: var(--foreground);
          margin: 0;
          font-size: 0.9375rem;
        }
        .upload-file-size {
          font-size: 0.8125rem;
          color: var(--muted-foreground);
          margin: 0;
        }
        .upload-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .upload-field-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--foreground);
        }
        .upload-field-input,
        .upload-field-select {
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          background: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
          transition: all 0.15s;
        }
        .upload-field-input:focus,
        .upload-field-select:focus {
          outline: none;
          border-color: var(--ring);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .upload-field-select {
          cursor: pointer;
        }
        .upload-field-textarea {
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          background: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
          transition: all 0.15s;
        }
        .upload-field-textarea:focus {
          outline: none;
          border-color: var(--ring);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .upload-field-checkbox {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
        }
        .upload-field-checkbox label {
          font-size: 0.875rem;
          color: var(--foreground);
          cursor: pointer;
        }
        .upload-warning-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 0.5rem;
          color: #92400e;
        }
        .upload-warning-banner svg {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .upload-warning-title {
          font-weight: 600;
          font-size: 0.875rem;
          margin: 0 0 0.125rem;
        }
        .upload-warning-text {
          font-size: 0.8125rem;
          margin: 0;
          opacity: 0.8;
        }
        .upload-retry-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .upload-retry-hint {
          font-size: 0.8125rem;
          color: var(--muted-foreground);
        }
        .upload-field-loading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          background: var(--muted);
          color: var(--muted-foreground);
          font-size: 0.875rem;
        }
        .upload-field-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.375rem;
          background: rgba(239, 68, 68, 0.08);
          color: #dc2626;
          font-size: 0.875rem;
        }
        .upload-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.5rem;
          color: #dc2626;
          font-size: 0.875rem;
        }
        .upload-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 0.5rem;
        }
        .upload-modal-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s;
        }
        .upload-modal-btn.primary {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .upload-modal-btn.primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .upload-modal-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .upload-modal-btn.secondary {
          background: var(--background);
          border-color: var(--border);
          color: var(--foreground);
        }
        .upload-modal-btn.secondary:hover {
          background: var(--muted);
        }
        .upload-success {
          text-align: center;
          padding: 2rem 0;
        }
        .upload-success-icon {
          color: #16a34a;
          margin-bottom: 1rem;
        }
        .upload-success h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--foreground);
          margin: 0 0 0.5rem;
        }
        .upload-success-filename {
          font-size: 0.875rem;
          color: var(--muted-foreground);
          margin: 0;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};
