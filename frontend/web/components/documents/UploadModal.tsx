'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  File,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  documentService,
  categoryService,
} from '@/services/document.service';
import type {
  DocumentUploadResponse,
  Category,
} from '@/types/document';

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
}

export function UploadModal({ onClose, onSuccess, categories }: UploadModalProps) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocument, setUploadedDocument] = useState<DocumentUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Metadata form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categorySlug: '',
    tags: [] as string[],
    language: 'vi',
    isPolicy: false,
  });
  const [tagInput, setTagInput] = useState('');
  const [confirming, setConfirming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Loại file không được hỗ trợ. Vui lòng chọn PDF, Word, Excel, Text, hoặc hình ảnh.');
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (selectedFile.size > maxSize) {
      setError('Kích thước file vượt quá giới hạn 100MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStep(2);
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
      setStep(3);
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
      
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Xác nhận thất bại. Vui lòng thử lại.');
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
      tags: formData.tags.filter((t) => t !== tag),
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
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'txt':
        return '📃';
      case 'png':
      case 'jpg':
      case 'jpeg':
        return '🖼️';
      default:
        return '📁';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tải lên tài liệu</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      s < step
                        ? 'bg-indigo-600 text-white'
                        : s === step
                        ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-600'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s < step ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  <span className={`ml-2 text-sm ${s === step ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>
                    {s === 1 && 'Chọn file'}
                    {s === 2 && 'Đang tải lên'}
                    {s === 3 && 'Xác nhận'}
                    {s === 4 && 'Hoàn thành'}
                  </span>
                  {s < 4 && (
                    <div className={`w-12 h-0.5 mx-2 ${s < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: File Selection */}
            {step === 1 && (
              <div>
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                    dragActive
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-indigo-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Kéo thả file vào đây hoặc</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    chọn file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                  />
                  <p className="mt-4 text-sm text-gray-500">
                    PDF, Word, Excel, Text, hoặc hình ảnh (tối đa 100MB)
                  </p>
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Uploading */}
            {step === 2 && file && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center text-4xl">
                  {getFileIcon(file.name)}
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">{file.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{formatFileSize(file.size)}</p>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {uploading ? `Đang tải lên... ${uploadProgress}%` : 'Sẵn sàng tải lên'}
                </p>
                
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="mt-6 inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {uploading ? 'Đang tải lên...' : 'Bắt đầu tải lên'}
                </button>
                
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Confirm Metadata */}
            {step === 3 && uploadedDocument && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-800">Tải lên thành công!</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {getFileIcon(file?.name || '')} {file?.name}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Nhập tiêu đề tài liệu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Nhập mô tả tài liệu"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                    <select
                      value={formData.categorySlug}
                      onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Chọn danh mục</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.slug}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">Tiếng Anh</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-indigo-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Nhập tag và nhấn Enter"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Thêm
                    </button>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPolicy"
                    checked={formData.isPolicy}
                    onChange={(e) => setFormData({ ...formData, isPolicy: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isPolicy" className="ml-2 text-sm text-gray-700">
                    Đây là tài liệu chính sách
                  </label>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Quay lại
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={confirming || !formData.title.trim()}
                    className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {confirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {confirming ? 'Đang xác nhận...' : 'Xác nhận và lưu'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tài liệu đã được lưu!</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Tài liệu "{formData.title}" đã được tải lên và sẵn sàng sử dụng.
                </p>
                <button
                  onClick={handleFinish}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Hoàn thành
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
