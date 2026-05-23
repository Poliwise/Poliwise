'use client';

import React, { useEffect, useRef } from 'react';
import { User, Bot, Copy, Check, ThumbsUp, ThumbsDown, AlertCircle, Clock, FileText, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { useUIStore } from '@/store/ui-store';
import type { Message, SourceDocument, FeedbackType } from '@/types';

interface ChatMessageProps {
  message: Message;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, type: FeedbackType) => void;
  onMarkUnanswered?: (messageId: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatLatency(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Count total chunks across all source documents */
function getTotalChunks(sources: SourceDocument[]): number {
  return sources.reduce((acc, s) => acc + (s.chunks?.length || 0), 0);
}

function getModelName(id?: string): string {
  if (!id) return '';
  const names: Record<string, string> = {
    'local/qwen3-8b': 'Qwen3 8B (Local)',
    'groq/qwen3-32b': 'Qwen3 32B (Groq)',
    'groq/llama-70b': 'Llama 3.3 70B (Groq)',
    'gemini/flash-2': 'Gemini 2.0 Flash',
    'openrouter/mistral-7b': 'Mistral 7B (OpenRouter)',
  };
  return names[id] || id;
}

export function ChatMessage({
  message,
  onCopy,
  onFeedback,
  onMarkUnanswered,
}: ChatMessageProps) {
  const isUser = message.role === 'USER';
  const [copied, setCopied] = React.useState(false);
  const openSourcesPanel = useUIStore((s) => s.openSourcesPanel);

  const requestedModel = message.modelRequested === 'default'
    ? 'local/qwen3-8b'
    : message.modelRequested;

  const isFallback = !isUser &&
    message.modelUsed &&
    requestedModel &&
    message.modelUsed !== requestedModel;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopy?.(message.content);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: FeedbackType) => {
    onFeedback?.(message.id, type);
  };

  const hasSources = !isUser && message.sources && message.sources.length > 0;
  const totalChunks = hasSources ? getTotalChunks(message.sources!) : 0;
  const totalDocs = hasSources ? message.sources!.length : 0;

  return (
    <div
      className={clsx(
        'flex gap-3 animate-slide-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div
        className={clsx(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-green-100 text-green-600'
        )}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div
        className={clsx(
          'flex flex-col gap-1 max-w-[80%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={clsx(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content}
            {message.isStreaming && !message.streamingCompleted && (
              <>
                {message.content.length === 0 ? (
                  <span className="inline-flex gap-1 ml-1 align-middle">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }}></span>
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }}></span>
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                  </span>
                ) : (
                  <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle"></span>
                )}
              </>
            )}
          </p>
        </div>

        {isFallback && (
          <div className="flex items-start gap-1.5 px-3 py-2 mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg border border-amber-200/50 max-w-full animate-fade-in">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Lưu ý:</span> Mô hình yêu cầu <span className="font-mono text-[10px] bg-amber-100/80 px-1 py-0.5 rounded">{getModelName(requestedModel)}</span> hiện không phản hồi. Hệ thống đã tự động chuyển sang mô hình dự phòng <span className="font-semibold text-amber-800">{getModelName(message.modelUsed)}</span> để đảm bảo câu trả lời không bị gián đoạn.
            </div>
          </div>
        )}

        {/* Layer 1: Inline Sources Summary */}
        {hasSources && (
          <div className="flex items-center gap-2 mt-1 px-1">
            <BookOpen size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              Được tổng hợp từ {totalChunks} chunks thuộc {totalDocs} tài liệu.
            </span>
            <button
              onClick={() => openSourcesPanel(message.sources!)}
              className="text-xs font-medium text-primary hover:underline hover:translate-x-0.5 transition-all duration-200 cursor-pointer"
            >
              Xem chi tiết nguồn
            </button>
          </div>
        )}

        {!isUser && (
          <div className="flex items-center gap-1 mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => handleFeedback('LIKE' as FeedbackType)}
              icon={<ThumbsUp size={14} />}
              title="Hữu ích"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => handleFeedback('DISLIKE' as FeedbackType)}
              icon={<ThumbsDown size={14} />}
              title="Không hữu ích"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              title="Sao chép"
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Clock size={12} />
              {formatTime(message.createdAt)}
              {message.latencyMs && (
                <span className="ml-1 text-muted-foreground/70">
                  · {formatLatency(message.latencyMs)}
                </span>
              )}
              {message.tokensTotal && (
                <span className="ml-1 text-muted-foreground/70">
                  · {message.tokensTotal} tokens
                </span>
              )}
            </span>
            {message.modelUsed && (
              <span className="text-xs text-muted-foreground/60 ml-2">
                · {message.modelUsed}
              </span>
            )}
          </div>
        )}

        {isUser && (
          <span className="text-xs text-muted-foreground mt-1">
            <Clock size={12} className="inline mr-1" />
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;