'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  CloudUpload,
  FileCheck,
} from 'lucide-react';
import {
  documentService,
} from '@/services/document.service';
import { api } from '@/lib/api';
import type {
  DocumentUploadResponse,
  Category,
} from '@/types/document';
import styles from './UploadModal.module.css';

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  initialDocument?: DocumentUploadResponse | any;
}

const STEPS = {
  SELECT: 1,
  UPLOAD: 2,
  METADATA: 3,
  COMPLETE: 4,
} as const;

const STEP_LABELS = ['Chọn file', 'Đang tải', 'Xác nhận', 'Hoàn thành'];

export function UploadModal({ onClose, onSuccess, categories, initialDocument }: UploadModalProps) {
  const [step, setStep] = useState<number>(initialDocument ? STEPS.METADATA : STEPS.SELECT);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocument, setUploadedDocument] = useState<DocumentUploadResponse | null>(initialDocument || null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: initialDocument?.title || initialDocument?.suggestedTitle || initialDocument?.originalFilename?.replace(/\.[^/.]+$/, '') || '',
    description: initialDocument?.description || initialDocument?.suggestedDescription || '',
    categorySlug: initialDocument?.categorySlug || initialDocument?.suggestedCategorySlug || '',
    tags: initialDocument?.tags || initialDocument?.suggestedTags || [] as string[],
    language: initialDocument?.language || initialDocument?.suggestedLanguage || 'vi',
    isPolicy: initialDocument?.isPolicy || initialDocument?.suggestedIsPolicy || false,
  });
  const [tagInput, setTagInput] = useState('');
  const [confirming, setConfirming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'image/png',
      'image/jpeg',
      'text/markdown',
      'text/x-markdown',
    ];
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'md'];

    if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(ext || '')) {
      setError('Loại file không được hỗ trợ. Vui lòng chọn PDF, Word, Excel, Text, Markdown, hoặc hình ảnh.');
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('Kích thước file vượt quá giới hạn 100MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStep(STEPS.UPLOAD);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const response = await documentService.uploadDocument(file, (percent) => {
        setUploadProgress(percent);
      });

      setUploadedDocument(response);
      setFormData({
        ...formData,
        title: response.suggestedTitle || file.name.replace(/\.[^/.]+$/, ''),
        description: response.suggestedDescription || '',
        categorySlug: response.suggestedCategorySlug || '',
        tags: response.suggestedTags || [],
        language: response.suggestedLanguage || 'vi',
        isPolicy: response.suggestedIsPolicy || false,
      });
      setStep(STEPS.METADATA);
    } catch (err: any) {
      setError(err.message || 'Tải lên thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!uploadedDocument) return;

    setConfirming(true);
    setError(null);

    try {
      await documentService.confirmMetadata(uploadedDocument.id, {
        title: formData.title,
        description: formData.description,
        categorySlug: formData.categorySlug,
        tags: formData.tags,
        language: formData.language,
        isPolicy: formData.isPolicy,
      });

      try {
        await api.documents.triggerProcess(uploadedDocument.id);
      } catch (processErr) {
        console.warn('Failed to trigger processing, document saved as READY:', processErr);
      }

      setStep(STEPS.COMPLETE);
      onSuccess();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosError.response?.data?.detail || axiosError.message || 'Có lỗi xảy ra khi xác nhận metadata.');
    } finally {
      setConfirming(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t: string) => t !== tag),
    });
  };

  const handleFinish = () => {
    onSuccess();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'txt': return '📃';
      case 'md': return '📋';
      case 'png':
      case 'jpg':
      case 'jpeg': return '🖼️';
      default: return '📁';
    }
  };

  const renderProgressSteps = () => (
    <div className={styles.progressBar}>
      <div className={styles.stepsContainer}>
        {[1, 2, 3, 4].map((s, idx) => (
          <React.Fragment key={s}>
            <div className={styles.step}>
              <div
                className={`${styles.stepDot} ${
                  s < step ? styles.completed :
                  s === step ? styles.active :
                  styles.pending
                }`}
              >
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              <span
                className={`${styles.stepLabel} ${
                  s < step ? styles.completed :
                  s === step ? styles.active :
                  styles.pending
                }`}
              >
                {STEP_LABELS[idx]}
              </span>
            </div>
            {s < 4 && (
              <div className={`${styles.stepConnector} ${s < step ? styles.completed : ''}`}>
                {s < step && <div className={styles.stepConnectorFill} style={{ width: '100%' }} />}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Tải lên tài liệu</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {step !== STEPS.COMPLETE && renderProgressSteps()}

        <div className={styles.content}>
          {step === STEPS.SELECT && (
            <div
              className={`${styles.dropzone} ${dragActive ? styles.active : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className={styles.dropzoneInput}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.md"
              />
              <div className={styles.dropzoneIcon}>
                <CloudUpload className="w-8 h-8" />
              </div>
              <p className={styles.dropzoneText}>
                Kéo thả file vào đây hoặc{' '}
                <span className={styles.dropzoneTextBold}>chọn file</span>
              </p>
              <p className={styles.dropzoneHint}>
                PDF, Word, Excel, Text, Markdown, hình ảnh (tối đa 100MB)
              </p>
            </div>
          )}

          {step === STEPS.UPLOAD && file && (
            <div className={styles.uploadPreview}>
              <div className={styles.fileIcon}>
                {getFileIcon(file.name)}
              </div>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>{formatFileSize(file.size)}</p>

              <div className={styles.progressContainer}>
                <div className={styles.uploadProgressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: uploading ? `${uploadProgress}%` : '0%' }}
                  />
                </div>
                <p className={styles.progressText}>
                  {uploading ? `Đang tải lên... ${uploadProgress}%` : 'Sẵn sàng tải lên'}
                </p>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className={styles.uploadBtn}
              >
                {uploading ? (
                  <>
                    <Loader2 className={`${styles.spinner} w-5 h-5`} />
                    Đang tải lên...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Bắt đầu tải lên
                  </>
                )}
              </button>
            </div>
          )}

          {step === STEPS.METADATA && uploadedDocument && (
            <div className={styles.form}>
              {error && (
                <div className={styles.error}>
                  <AlertCircle className={`${styles.errorIcon} w-5 h-5`} />
                  <span>{error}</span>
                </div>
              )}

              <div className={styles.successBanner}>
                <div className={styles.successBannerLeft}>
                  <div className={styles.successIcon}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className={styles.successText}>Tải lên thành công!</span>
                </div>
                <span className={styles.successFilename}>
                  {getFileIcon(file?.name || '')} {file?.name}
                </span>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Tiêu đề <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={styles.fieldInput}
                  placeholder="Nhập tiêu đề tài liệu"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                  placeholder="Nhập mô tả tài liệu"
                  rows={3}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Danh mục</label>
                  <select
                    value={formData.categorySlug}
                    onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
                    className={`${styles.fieldInput} ${styles.fieldSelect}`}
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Ngôn ngữ</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className={`${styles.fieldInput} ${styles.fieldSelect}`}
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">Tiếng Anh</option>
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Tags</label>
                <div className={styles.tagsContainer}>
                  {formData.tags.map((tag: string) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className={styles.tagRemove}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className={styles.tagInput}
                    placeholder={formData.tags.length === 0 ? 'Nhập tag và nhấn Enter' : ''}
                  />
                </div>
              </div>

              <div className={`${styles.field} ${styles.checkboxField}`}>
                <input
                  type="checkbox"
                  id="isPolicy"
                  checked={formData.isPolicy}
                  onChange={(e) => setFormData({ ...formData, isPolicy: e.target.checked })}
                  className={styles.checkbox}
                />
                <label htmlFor="isPolicy" className={styles.checkboxLabel}>
                  Đây là tài liệu chính sách
                </label>
              </div>
            </div>
          )}

          {step === STEPS.COMPLETE && (
            <div className={styles.successScreen}>
              <div className={styles.successScreenIcon}>
                <FileCheck className="w-10 h-10" />
              </div>
              <h3 className={styles.successScreenTitle}>Tài liệu đã được lưu!</h3>
              <p className={styles.successScreenText}>
                Tài liệu "{formData.title}" đã được tải lên và sẵn sàng sử dụng.
              </p>
              <button onClick={handleFinish} className={styles.finishBtn}>
                Hoàn thành
              </button>
            </div>
          )}
        </div>

        {step === STEPS.METADATA && (
          <div className={styles.actions}>
            {!initialDocument && (
              <button
                onClick={() => setStep(STEPS.UPLOAD)}
                className={styles.backBtn}
              >
                <ChevronLeft className="w-4 h-4" />
                Quay lại
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={confirming || !formData.title.trim()}
              className={styles.primaryBtn}
            >
              {confirming ? (
                <>
                  <Loader2 className={`${styles.spinner} w-4 h-4`} />
                  Đang xác nhận...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Xác nhận và lưu
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
