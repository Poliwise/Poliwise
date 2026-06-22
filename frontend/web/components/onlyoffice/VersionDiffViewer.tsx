import React from 'react';
import { DiffLine } from '@/services/onlyoffice.service';

interface VersionDiffViewerProps {
  baseVersion: number;
  compareVersion: number;
  diffLines: DiffLine[];
  baseContent?: string;
  theirContent?: string;
  theirChangelog?: string;
  theirCreatedAt?: string;
  theirCreatedByUsername?: string;
  baseLabel?: string;
  compareLabel?: string;
}

export function VersionDiffViewer({
  baseVersion,
  compareVersion,
  diffLines,
  baseContent,
  theirContent,
  theirChangelog,
  theirCreatedAt,
  theirCreatedByUsername,
  baseLabel = `Cơ sở (v${baseVersion})`,
  compareLabel = `Mới nhất (v${compareVersion})`,
}: VersionDiffViewerProps) {
  const stats = {
    added: diffLines.filter(l => l.type === 'ADDED').length,
    deleted: diffLines.filter(l => l.type === 'DELETED').length,
  };

  const renderDiffLine = (line: DiffLine, idx: number) => {
    const prefix = line.type === 'ADDED' ? '+' : line.type === 'DELETED' ? '-' : ' ';
    const bgClass = line.type === 'ADDED'
      ? 'bg-green-50 text-green-900'
      : line.type === 'DELETED'
      ? 'bg-red-50 text-red-900'
      : 'text-gray-700';

    return (
      <div
        key={idx}
        className={`flex font-mono text-xs leading-6 ${bgClass}`}
      >
        <span className="w-12 flex-shrink-0 text-right pr-3 text-gray-400 select-none border-r border-gray-200 mr-3">
          {line.type === 'DELETED' ? line.lineNumber : line.type === 'ADDED' ? line.lineNumber : ' '}
        </span>
        <span className="w-5 flex-shrink-0 text-center select-none text-gray-400">{prefix}</span>
        <span className="whitespace-pre-wrap break-all flex-1 px-2">{line.content || ' '}</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* LEFT: Base version */}
      <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <p className="text-sm font-semibold text-blue-900">{baseLabel}</p>
          <p className="text-xs text-blue-600">Phiên bản bạn bắt đầu chỉnh sửa</p>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          <pre className="text-xs font-mono leading-6 p-3 whitespace-pre-wrap break-all text-gray-700 bg-white h-full min-h-48">
            {baseContent || 'Không có nội dung'}
          </pre>
        </div>
      </div>

      {/* CENTER: The diff */}
      <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Sự khác biệt</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-600">+{stats.added} dòng</span>
              <span className="text-red-600">-{stats.deleted} dòng</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Thay đổi của bạn so với phiên bản mới nhất
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          {diffLines.length > 0 ? (
            <div>{diffLines.map(renderDiffLine)}</div>
          ) : (
            <pre className="text-xs font-mono leading-6 p-3 text-gray-500">
              Không có sự khác biệt về text giữa hai phiên bản
            </pre>
          )}
        </div>
      </div>

      {/* RIGHT: Their version (newest) */}
      <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
          <p className="text-sm font-semibold text-purple-900">{compareLabel}</p>
          <p className="text-xs text-purple-600">Phiên bản mới nhất đã được tải lên</p>
          {theirChangelog && (
            <p className="text-xs text-purple-500 italic mt-1">
              Ghi chú: {theirChangelog}
            </p>
          )}
          {(theirCreatedAt || theirCreatedByUsername) && (
            <p className="text-xs text-purple-400 mt-0.5">
              {theirCreatedByUsername && `bởi ${theirCreatedByUsername}`}
              {theirCreatedAt && ` • ${new Date(theirCreatedAt).toLocaleString('vi-VN')}`}
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          <pre className="text-xs font-mono leading-6 p-3 whitespace-pre-wrap break-all text-gray-700 bg-white h-full min-h-48">
            {theirContent || 'Không có nội dung'}
          </pre>
        </div>
      </div>
    </div>
  );
}
