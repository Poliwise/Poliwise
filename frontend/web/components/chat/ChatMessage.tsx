'use client';

import React, { useEffect, useRef } from 'react';
import { User, Bot, Copy, Check, ThumbsUp, ThumbsDown, AlertCircle, Clock, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { SourcesPanel } from './SourcesPanel';
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

export function ChatMessage({
  message,
  onCopy,
  onFeedback,
  onMarkUnanswered,
}: ChatMessageProps) {
  const isUser = message.role === 'USER';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopy?.(message.content);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: FeedbackType) => {
    onFeedback?.(message.id, type);
  };

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

        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesPanel sources={message.sources} />
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