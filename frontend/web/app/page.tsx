'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, ThumbsUp, ThumbsDown, Copy, Check, ExternalLink, FileText, Clock, MessageSquare } from 'lucide-react';
import { MainLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import type { Conversation, Source, FeedbackType } from '@/types';
import styles from './chat.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  feedback?: FeedbackType;
  timestamp: string;
  isLoading?: boolean;
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: 'loading',
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const response = await api.ai.ask({ question: userMessage.content });

      const assistantMessage: Message = {
        id: response.conversationId || Date.now().toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === 'loading' ? assistantMessage : m))
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'loading'
            ? {
                ...m,
                isLoading: false,
                content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.',
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = async (messageId: string, type: FeedbackType) => {
    try {
      await api.ai.giveFeedback(messageId, type);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: type } : m))
      );
    } catch (error) {
      console.error('Failed to submit feedback');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copySourceContent = (source: Source) => {
    return `${source.documentTitle}\n${source.excerpt}`;
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        {/* Sidebar History */}
        <aside className={`${styles.historySidebar} ${showHistory ? styles.open : ''}`}>
          <div className={styles.historyHeader}>
            <h3>Lịch sử hội thoại</h3>
            <button onClick={() => setShowHistory(false)}>Đóng</button>
          </div>
          <div className={styles.historyList}>
            {messages.filter(m => m.role === 'user').length === 0 ? (
              <p className={styles.emptyHistory}>Chưa có cuộc trò chuyện nào</p>
            ) : (
              messages
                .filter(m => m.role === 'user')
                .map((m) => (
                  <button
                    key={m.id}
                    className={styles.historyItem}
                    onClick={() => setShowHistory(false)}
                  >
                    <MessageSquare size={16} />
                    <span>{m.content.slice(0, 50)}...</span>
                  </button>
                ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className={styles.chatArea}>
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>
                <MessageSquare size={48} />
              </div>
              <h1>Xin chào, {user?.username || 'bạn'}!</h1>
              <p>Tôi có thể giúp gì cho bạn hôm nay?</p>
              <div className={styles.suggestions}>
                <button onClick={() => setInput('Chính sách nhân sự mới nhất là gì?')}>
                  Chính sách nhân sự mới nhất là gì?
                </button>
                <button onClick={() => setInput('Quy trình xin nghỉ phép như thế nào?')}>
                  Quy trình xin nghỉ phép như thế nào?
                </button>
                <button onClick={() => setInput('Các quy định về bảo mật thông tin?')}>
                  Các quy định về bảo mật thông tin?
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.messages}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.message} ${styles[message.role]}`}
                >
                  <div className={styles.messageIcon}>
                    {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={styles.messageContent}>
                    {message.isLoading ? (
                      <div className={styles.loading}>
                        <Loader2 size={20} className={styles.spinner} />
                        <span>Đang xử lý...</span>
                      </div>
                    ) : (
                      <>
                        <p className={styles.messageText}>{message.content}</p>

                        {message.sources && message.sources.length > 0 && (
                          <div className={styles.sources}>
                            <h4>Nguồn tham khảo:</h4>
                            {message.sources.map((source, idx) => (
                              <div key={idx} className={styles.source}>
                                <div className={styles.sourceHeader}>
                                  <FileText size={14} />
                                  <span className={styles.sourceTitle}>{source.documentTitle}</span>
                                  {source.page && <span className={styles.sourcePage}>Trang {source.page}</span>}
                                </div>
                                <p className={styles.sourceExcerpt}>{source.excerpt}</p>
                                <button
                                  className={styles.sourceAction}
                                  onClick={() => handleCopy(copySourceContent(source), `${message.id}-source-${idx}`)}
                                >
                                  {copiedId === `${message.id}-source-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {message.role === 'assistant' && (
                          <div className={styles.messageActions}>
                            <button
                              className={`${styles.actionButton} ${message.feedback === 'LIKE' ? styles.active : ''}`}
                              onClick={() => handleFeedback(message.id, 'LIKE')}
                              title="Hữu ích"
                            >
                              <ThumbsUp size={16} />
                            </button>
                            <button
                              className={`${styles.actionButton} ${message.feedback === 'DISLIKE' ? styles.active : ''}`}
                              onClick={() => handleFeedback(message.id, 'DISLIKE')}
                              title="Không hữu ích"
                            >
                              <ThumbsDown size={16} />
                            </button>
                            <button
                              className={styles.actionButton}
                              onClick={() => handleCopy(message.content, message.id)}
                              title="Sao chép"
                            >
                              {copiedId === message.id ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          </div>
                        )}

                        <span className={styles.timestamp}>
                          <Clock size={12} />
                          {formatTime(message.timestamp)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSubmit} className={styles.inputArea}>
            <div className={styles.inputWrapper}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi của bạn..."
                className={styles.input}
                rows={1}
                disabled={isLoading}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? <Loader2 size={20} className={styles.spinner} /> : <Send size={20} />}
              </button>
            </div>
            <p className={styles.hint}>Nhấn Enter để gửi, Shift + Enter để xuống dòng</p>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
