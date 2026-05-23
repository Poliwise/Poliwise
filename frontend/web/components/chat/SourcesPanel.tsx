'use client';

import React, { useState } from 'react';
import { X, FileText, ChevronDown, ChevronRight, Copy, Check, Search, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useUIStore } from '@/store/ui-store';
import type { SourceDocument, ChunkRef } from '@/types';

/**
 * Layer 2: Right-side sliding accordion panel showing sources grouped by document.
 * Opens when user clicks "Xem chi tiết nguồn" in ChatMessage.
 */
export function SourcesPanel() {
  const { isSourcesPanelOpen, activeMessageSources, closeSourcesPanel, openDocumentViewer } = useUIStore();
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isSourcesPanelOpen) return null;

  const toggleDoc = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleCopyChunk = async (chunk: ChunkRef) => {
    const text = `${chunk.sectionTitle ? chunk.sectionTitle + '\n' : ''}${chunk.excerpt}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(chunk.chunkId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleViewDocument = (source: SourceDocument) => {
    const highlights = source.chunks.map((c) => c.excerpt);
    openDocumentViewer(source.documentId, source.documentName, highlights, source.chunks);
  };

  const totalChunks = activeMessageSources.reduce((acc, s) => acc + (s.chunks?.length || 0), 0);

  return (
    <div
      className="
        flex flex-col
        w-[360px] max-w-full
        h-full
        border-l border-border
        bg-background
        animate-in slide-in-from-right duration-300
        shadow-lg
        overflow-hidden
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Nguồn tham khảo</h3>
          <Badge variant="neutral" className="text-xs">
            {activeMessageSources.length} tài liệu · {totalChunks} chunks
          </Badge>
        </div>
        <button
          onClick={closeSourcesPanel}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Đóng panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Document list (scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeMessageSources.map((source) => {
          const isExpanded = expandedDocs.has(source.documentId);
          const topScore = Math.max(...(source.chunks?.map((c) => c.similarityScore) || [source.relevanceScore]));

          return (
            <div
              key={source.documentId}
              className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden transition-all duration-200 hover:border-border"
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleDoc(source.documentId)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex-shrink-0 text-muted-foreground">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <FileText size={14} className="flex-shrink-0 text-primary" />
                <span className="flex-1 text-sm font-medium text-foreground truncate">
                  {source.documentName}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {source.chunks?.length || 0} chunks
                </span>
                <Badge
                  variant="info"
                  className="text-xs font-normal flex-shrink-0"
                >
                  {(topScore * 100).toFixed(0)}%
                </Badge>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Chunk list */}
                  {source.chunks?.map((chunk) => (
                    <div
                      key={chunk.chunkId}
                      className="bg-muted/40 rounded-lg p-2.5 border border-border/40 group"
                    >
                      {chunk.sectionTitle && (
                        <p className="text-xs font-semibold text-primary/80 mb-1">
                          ## {chunk.sectionTitle}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {chunk.excerpt}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground/60">
                          {(chunk.similarityScore * 100).toFixed(0)}% tương đồng
                        </span>
                        <button
                          onClick={() => handleCopyChunk(chunk)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                          title="Sao chép nội dung chunk"
                        >
                          {copiedId === chunk.chunkId ? (
                            <Check size={12} className="text-green-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* View full document button */}
                  <button
                    onClick={() => handleViewDocument(source)}
                    className="
                      w-full flex items-center justify-center gap-1.5
                      text-xs font-medium text-primary
                      py-2 rounded-lg
                      border border-primary/20
                      hover:bg-primary/5 hover:border-primary/40
                      transition-all duration-200
                    "
                  >
                    <Search size={12} />
                    Xem chi tiết bản toàn văn
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SourcesPanel;