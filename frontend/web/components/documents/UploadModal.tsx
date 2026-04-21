'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
} from '@/components/ui';
import { TagInput } from './TagInput';
import { api } from '@/lib/api';
import type { DocumentUploadResponse } from '@/types';
import styles from './UploadModal.module.css';

type Step = 'select' | 'review' | 'done';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categorySlug, setCategorySlug] = useState('none');
  const [tags, setTags] = useState<string[]>([]);
  const [isPolicy, setIsPolicy] = useState(false);
  const [language, setLanguage] = useState('vi');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const hasFetchedCategories = useRef(false);

  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [aiSuggestionAvailable, setAiSuggestionAvailable] = useState<boolean | null>(null);

  const [uploadedDoc, setUploadedDoc] = useState<DocumentUploadResponse | null>(null);

  // Fetch categories when modal opens
  useEffect(() => {
    if (!isOpen || categories.length > 0 || categoriesLoading || categoriesError || hasFetchedCategories.current) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    hasFetchedCategories.current = true;
    api.metadata
      .getCategories()
      .then(setCategories)
      .catch(() => setCategoriesError('Không thể tải danh mục'))
      .finally(() => setCategoriesLoading(false));
  }, [isOpen, categories.length, categoriesLoading, categoriesError]);

  // Pre-select category when AI suggestion arrives
  useEffect(() => {
    if (categories.length > 0 && uploadedDoc?.suggestedCategorySlug && step === 'review') {
      const match = categories.some((c) => c.slug === uploadedDoc.suggestedCategorySlug);
      setCategorySlug(match ? uploadedDoc.suggestedCategorySlug! : 'none');
    }
  }, [categories, uploadedDoc?.suggestedCategorySlug, step]);

  // Reset on close
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
      setError(null);
      setRetryCount(0);
      setAiSuggestionAvailable(null);
      setUploadedDoc(null);
      setCategoriesLoading(false);
      setCategoriesError(null);
    }
  }, [isOpen]);

  const handleClose = useCallback(async () => {
    if (step === 'review' && uploadedDoc?.id) {
      setCancelling(true);
      try {
        await api.documents.cancel(uploadedDoc.id);
      } catch { /* ignore cancel errors */ }
      setCancelling(false);
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

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const response = await api.documents.upload(selectedFile);
      const hasSuggestion = !!(
        response.suggestedTitle ||
        response.suggestedDescription ||
        response.suggestedCategorySlug ||
        response.suggestedLanguage ||
        (response.suggestedTags && response.suggestedTags.length > 0)
      );

      setAiSuggestionAvailable(hasSuggestion);

      if (hasSuggestion) {
        setTitle(response.suggestedTitle || '');
        setDescription(response.suggestedDescription || '');
        setTags(response.suggestedTags || []);
        setIsPolicy(response.suggestedIsPolicy || false);
        setLanguage(response.suggestedLanguage?.toLowerCase().startsWith('en') ? 'en' : 'vi');
      } else {
        setTitle('');
        setDescription('');
        setTags([]);
        setIsPolicy(false);
        setLanguage('vi');
      }

      setUploadedDoc(response);
      setStep('review');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosError.response?.data?.detail || axiosError.message || 'Có lỗi xảy ra khi tải lên.');
    } finally {
      setUploading(false);
    }
  }, [selectedFile]);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    handleUpload();
  }, [handleUpload]);

  const handleConfirm = useCallback(async () => {
    if (!uploadedDoc?.id) return;
    setConfirming(true);
    setError(null);

    try {
      await api.documents.confirmMetadata(uploadedDoc.id, {
        title,
        description,
        categorySlug: categorySlug === 'none' ? '' : categorySlug,
        tags,
        language,
        isPolicy,
      });
      setStep('done');
      onSuccess();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosError.response?.data?.detail || axiosError.message || 'Có lỗi xảy ra khi xác nhận metadata.');
    } finally {
      setConfirming(false);
    }
  }, [uploadedDoc, title, description, categorySlug, tags, language, isPolicy, onSuccess]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stepTitles: Record<Step, string> = {
    select: 'Tải tài liệu lên',
    review: aiSuggestionAvailable ? 'Xem xét metadata gợi ý' : 'Nhập metadata',
    done: 'Thành công',
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title={stepTitles[step]} size="lg">
      {/* ── STEP 1: File Selection ─────────────────────────── */}
      {step === 'select' && (
        <div className={styles.step}>
          <div
            className={`${styles.dropzone} ${selectedFile ? styles.hasFile : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {selectedFile ? (
              <div className={styles.fileInfo}>
                <FileText size={32} className={styles.fileIcon} />
                <div>
                  <p className={styles.fileName}>{selectedFile.name}</p>
                  <p className={styles.fileSize}>{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  type="button"
                  className={styles.removeFile}
                  onClick={() => setSelectedFile(null)}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} className={styles.dropzoneIcon} />
                <p className={styles.dropzoneText}>Kéo thả file vào đây, hoặc</p>
                <label className={styles.dropzoneBtn}>
                  Chọn file
                  <input type="file" onChange={handleFileChange} hidden />
                </label>
              </>
            )}
          </div>

          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={handleClose}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              loading={uploading}
              icon={<Upload size={16} />}
            >
              {uploading ? 'Đang xử lý...' : 'Tiếp tục'}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Metadata Review ─────────────────────────── */}
      {step === 'review' && (
        <div className={styles.step}>
          {!aiSuggestionAvailable && (
            <div className={styles.warningBanner}>
              <AlertTriangle size={18} />
              <div>
                <p className={styles.warningTitle}>Không thể tự động gợi ý metadata</p>
                <p className={styles.warningText}>
                  Vui lòng nhập thủ công hoặc{' '}
                  {retryCount < 2 ? (
                    <button type="button" className={styles.retryLink} onClick={handleRetry}>
                      thử lại
                    </button>
                  ) : (
                    <span>đã hết lượt thử</span>
                  )}
                  .
                </p>
              </div>
            </div>
          )}

          {aiSuggestionAvailable && (
            <p className={styles.suggestionNote}>
              Các trường bên dưới được AI gợi ý từ nội dung tài liệu. Bạn có thể chỉnh sửa trước khi xác nhận.
            </p>
          )}

          <div className={styles.fields}>
            <Input
              label="Tiêu đề"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề tài liệu..."
              required
            />

            <Textarea
              label="Mô tả"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về tài liệu..."
              rows={3}
            />

            <Select
              label="Danh mục"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              options={[
                { value: 'none', label: 'Không có' },
                ...categories.map((c) => ({ value: c.slug, label: c.name })),
              ]}
              placeholder={
                categoriesLoading
                  ? 'Đang tải...'
                  : categoriesError
                    ? 'Lỗi tải danh mục'
                    : undefined
              }
              disabled={categoriesLoading || !!categoriesError}
            />

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Tags</label>
              {categoriesError ? (
                <p className={styles.fieldError}>{categoriesError}</p>
              ) : (
                <TagInput value={tags} onChange={setTags} placeholder="Thêm tag rồi nhấn Enter..." />
              )}
            </div>

            <Select
              label="Ngôn ngữ"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={[
                { value: 'vi', label: 'Tiếng Việt' },
                { value: 'en', label: 'English' },
              ]}
            />

            <Checkbox
              id="isPolicy"
              checked={isPolicy}
              onChange={(e) => setIsPolicy(e.target.checked)}
              label="Là tài liệu chính sách/quy định"
            />
          </div>

          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={cancelling}
              loading={cancelling}
            >
              {cancelling ? 'Đang hủy...' : 'Hủy'}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={confirming || !title.trim()}
              loading={confirming}
            >
              {confirming ? 'Đang xác nhận...' : 'Xác nhận'}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Success ────────────────────────────────── */}
      {step === 'done' && (
        <div className={styles.success}>
          <div className={styles.successIcon}>
            <CheckCircle size={48} />
          </div>
          <h3 className={styles.successTitle}>Tải lên thành công!</h3>
          <p className={styles.successFilename}>{selectedFile?.name}</p>
          <p className={styles.successNote}>
            Tài liệu đang được xử lý và sẽ sớm xuất hiện trong kho tài liệu.
          </p>
          <Button variant="primary" onClick={handleClose}>
            Đóng
          </Button>
        </div>
      )}
    </Modal>
  );
}

export default UploadModal;
