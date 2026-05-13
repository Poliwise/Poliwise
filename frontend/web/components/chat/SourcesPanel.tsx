'use client';

import React from 'react';
import { FileText, ExternalLink, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { SourceDocument } from '@/types';

interface SourcesPanelProps {
  sources: SourceDocument[];
  onSourceClick?: (source: SourceDocument) => void;
}

export function SourcesPanel({ sources, onSourceClick }: SourcesPanelProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!sources || sources.length === 0) return null;

  const handleCopy = async (source: SourceDocument, index: number) => {
    const text = `${source.documentName}\n${source.excerpt}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(`${index}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded-xl border border-border max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Nguồn tham khảo
        </span>
        <Badge variant="neutral" className="text-xs">{sources.length}</Badge>
      </div>

      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={`${source.documentId}-${index}`}
            className="bg-background rounded-lg p-3 border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onSourceClick?.(source)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline text-left truncate"
                >
                  <FileText size={14} />
                  {source.documentName}
                </button>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {source.excerpt}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge variant="info" className="text-xs font-normal">
                  {(source.relevanceScore * 100).toFixed(0)}%
                </Badge>
                <button
                  onClick={() => handleCopy(source, index)}
                  className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
                  title="Sao chép"
                >
                  {copiedId === `${index}` ? (
                    <Check size={12} className="text-green-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SourcesPanel;