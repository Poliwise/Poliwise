# Implementation Plan: Model Selection + Streaming Effects

## Files to Modify

### 1. `types/ai.ts`
- Add `ModelInfo` interface
- Add `modelId?: string` to `QuestionRequest` and `ChatRequest`

### 2. `lib/api.ts`
- Add `getModels(): Promise<ModelInfo[]>` to `api.ai` namespace
- Update `askStream` to include `modelId` in the JSON body

### 3. New: `components/chat/ModelSelector.tsx`
- Dropdown select component
- Shows model name + status indicator (green/yellow/red dot)
- Marks default model with "(Mặc định)" label
- Persists selection in localStorage key `selected-model-id`
- Props: `models: ModelInfo[]`, `value: string`, `onChange: (id: string) => void`, `disabled?: boolean`

### 4. `components/chat/ChatInput.tsx`
- Add `modelSelector` slot/prop or integrate ModelSelector directly
- Place dropdown to the left of the send button, inside the input bar

### 5. `components/chat/ChatContainer.tsx`
- Add state: `selectedModelId: string` (initialized from localStorage or default)
- Add `models: ModelInfo[]` state, fetch on mount via `api.ai.getModels()`
- Pass `modelId: selectedModelId` to `askStream()` call
- Pass `models`, `selectedModelId`, `onModelChange` to ChatInput
- Pass `modelUsed` info to ChatMessage (already in Message type)

### 6. `components/chat/ChatMessage.tsx`
- Add streaming visual effects:
  - **Before first token** (content is empty + isStreaming): show animated typing dots "..."
  - **During streaming** (content exists + isStreaming): show blinking cursor `|` after text
- Show `modelUsed` as a small badge/label below assistant messages when available
- CSS animation for blinking cursor via Tailwind `animate-pulse` or custom keyframes

## Detailed Changes

### types/ai.ts
```typescript
// Add before ChatRequest:
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string | null;
  contextWindow: number;
  isDefault: boolean;
  status: 'available' | 'rate_limited' | 'unavailable';
  rateLimitedUntil: string | null;
}

// Update ChatRequest:
export interface ChatRequest {
  message: string;
  conversationId?: string;
  modelId?: string;  // ADD THIS
  context?: { ... };
}

// Update QuestionRequest:
export interface QuestionRequest {
  question: string;
  conversationId?: string;
  department?: string;
  modelId?: string;  // ADD THIS
}
```

### lib/api.ts
```typescript
// Add to api.ai namespace:
getModels: async (): Promise<ModelInfo[]> => {
  const res = await this.client.get<ApiResponse<{ models: ModelInfo[] }>>('/api/v1/ai/models');
  const root = res.data as unknown as Record<string, unknown> | null;
  if (root && 'data' in root && typeof root.data === 'object' && root.data !== null) {
    const data = root.data as { models?: ModelInfo[] };
    return data.models ?? [];
  }
  return [];
},

// Update askStream body:
body: JSON.stringify({ ...data, modelId: data.modelId || 'default' }),
```

### components/chat/ModelSelector.tsx (NEW FILE)
- Native `<select>` element styled with Tailwind
- Options show: `{name}` + status dot + "(Mặc định)" if isDefault
- Disabled options for rate_limited/unavailable models
- Compact design to fit in input bar

### ChatInput.tsx changes
- Add `modelSelector?: React.ReactNode` prop
- Render it between textarea and send button

### ChatContainer.tsx changes
```typescript
const [models, setModels] = useState<ModelInfo[]>([]);
const [selectedModelId, setSelectedModelId] = useState('default');

useEffect(() => {
  api.ai.getModels().then(setModels).catch(() => {});
  const saved = localStorage.getItem('selected-model-id');
  if (saved) setSelectedModelId(saved);
}, []);

// In handleSubmit:
const stream = api.ai.askStream({
  question: text.trim(),
  conversationId: selectedConversationId,
  modelId: selectedModelId,
}, abortControllerRef.current.signal);
```

### ChatMessage.tsx changes
```tsx
// In the assistant message content area:
<p className="whitespace-pre-wrap leading-relaxed">
  {message.content}
  {message.isStreaming && !message.streamingCompleted && (
    <>
      {message.content.length === 0 ? (
        <span className="inline-flex gap-1 ml-1">
          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
        </span>
      ) : (
        <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle"></span>
      )}
    </>
  )}
</p>

// Add model badge below assistant messages:
{!isUser && message.modelUsed && (
  <span className="text-xs text-muted-foreground/60 mt-1">
    {message.modelUsed}
  </span>
)}
```
