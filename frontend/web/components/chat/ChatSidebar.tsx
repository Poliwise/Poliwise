'use client';

import React, { useState } from 'react';
import { Search, Plus, MessageSquare, Trash2, X, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Input, ConfirmDialog } from '@/components/ui';
import { useConversations, useDeleteConversation } from '@/hooks/useChat';
import type { Conversation } from '@/types';

interface ChatSidebarProps {
  selectedId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Hôm qua';
  } else if (days < 7) {
    return `${days} ngày trước`;
  } else {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function ChatSidebar({
  selectedId,
  onSelect,
  onNewChat,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const { data, isLoading } = useConversations({ keyword: search || undefined });
  const deleteMutation = useDeleteConversation();

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteMutation.mutateAsync(deleteTarget.id);
      if (selectedId === deleteTarget.id) {
        onSelect('');
      }
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <aside
        className={clsx(
          'fixed lg:relative z-40 h-full w-72 bg-background border-r border-border flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Lịch sử hội thoại</h2>
            <button
              onClick={onClose}
              className="lg:hidden p-1 hover:bg-accent rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full pl-9 pr-3 py-2 bg-muted border border-input rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-3">
          <Button
            variant="outline"
            fullWidth
            onClick={onNewChat}
            icon={<Plus size={16} />}
            className="justify-start"
          >
            Cuộc trò chuyện mới
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !data?.conversations?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p>Chưa có cuộc trò chuyện nào</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg transition-colors group relative',
                    selectedId === conv.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare
                      size={16}
                      className={clsx(
                        'flex-shrink-0 mt-0.5',
                        selectedId === conv.id ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {truncate(conv.title || 'Cuộc trò chuyện mới', 40)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(conv.lastMessageAt)}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          · {conv.messageCount} tin nhắn
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(conv);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 lg:hidden z-30"
          onClick={onClose}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xóa cuộc trò chuyện"
        message={`Bạn có chắc muốn xóa "${deleteTarget?.title || 'cuộc trò chuyện này'}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDelete}
        loading={deleteMutation.isLoading}
      />
    </>
  );
}

export default ChatSidebar;