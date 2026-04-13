'use client';

import React, { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder = 'Thêm tag...' }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  return (
    <div className="tag-input-container">
      <div className="tag-list">
        {value.map((tag, index) => (
          <span key={`${tag}-${index}`} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-remove"
              onClick={() => removeTag(index)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="tag-input-field"
      />
      <style>{`
        .tag-input-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.5rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          background: var(--background);
          min-height: 2.5rem;
          align-items: center;
          cursor: text;
        }
        .tag-input-container:focus-within {
          border-color: var(--ring);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: var(--primary);
          color: var(--primary-foreground);
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
        }
        .tag-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          opacity: 0.7;
          transition: opacity 0.15s;
        }
        .tag-remove:hover {
          opacity: 1;
        }
        .tag-input-field {
          flex: 1;
          min-width: 120px;
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.875rem;
          color: var(--foreground);
          padding: 0.25rem;
        }
        .tag-input-field::placeholder {
          color: var(--muted-foreground);
        }
      `}</style>
    </div>
  );
};
