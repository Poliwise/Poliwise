# Changes Report: MinIO Storage Migration & Highlighting Fix

**Date:** 2026-05-20
**Scope:** 5 phases across 3 services (knowledge-service, ai-qa-service, frontend)

---

## Phase 1: Backend (Knowledge Service) — Load Original File from MinIO

### `StorageService.java`
- **Added** `readFileContent(String fileKey)` method
- Reads MinIO object as UTF-8 string via `InputStream.readAllBytes()`
- Located at `services/knowledge-service/.../service/StorageService.java:95-106`

### `DocumentManagementService.java`
- **Replaced** `getExtractedText()` DB-read logic with MinIO file fetch
- Versioned requests: `storageService.readFileContent(version.getFileKey())`
- Unversioned requests: `storageService.readFileContent(document.getFileKey())`
- Removed fallback chain to `extracted_text` DB column
- Located at `services/knowledge-service/.../service/DocumentManagementService.java:328-339`

---

## Phase 2: Backend (AI QA Service) — Return Full Chunk Content

### `chat.py`
- **Added** `full_content: str` field to `ChunkRef` Pydantic model
- **Updated** `build_sources()` to populate `full_content=chunk.content` alongside existing truncated `excerpt`
- Located at `services/ai-qa-service/src/api/routes/chat.py:73-78, 134-140`

### `ai.ts`
- **Added** `fullContent: string` to `ChunkRef` TypeScript interface
- Located at `frontend/web/types/ai.ts:15`

---

## Phase 3: Frontend — Configure Mark.js for Markdown

### `DocumentViewerModal.tsx`
- **Changed** search string source from `c.excerpt` to `c.fullContent`
- **Updated** mark.js config:
  - `accuracy: 'exactly'` (was `'partially'`)
  - Added `acrossElements: true`
  - Added `ignoreJoiners: true`
  - Removed `separateWordSearch: false`

---

## Phase 4: Frontend — Fix Race Condition & Minimap Initialization

### `DocumentViewerModal.tsx`
- **Added** `marksApplied` state (`useState(false)`)
- **Added** `minimapPositions` state (`useState<MinimapPosition[]>([])`)
- **Reset** `marksApplied` to `false` at start of mark.js effect
- **Added** `done` callback to mark.js that sets `marksApplied = true` after all chunks processed
- **Moved** minimap computation into separate `useEffect` with `[marksApplied]` dependency
- **Updated** JSX to render from `minimapPositions` state instead of calling `getMinimapPositions()` during render

---

## Phase 5: Cleanup & Memory Safety

### `DocumentViewerModal.tsx`
- **Added** cleanup function `return () => { markInstance.unmark(); }` to mark.js effect
- Prevents stale DOM highlights on modal close/reopen/document switch

---

## Additional: SourcesPanel

- **No changes needed** — `SourcesPanel.tsx` already passes `source.chunks` (full `ChunkRef[]`) to `openDocumentViewer`, which now carries `fullContent` automatically

---

## Files Modified (5 total)

| File | Service | Changes |
|---|---|---|
| `StorageService.java` | knowledge-service | +1 method (`readFileContent`) |
| `DocumentManagementService.java` | knowledge-service | Modified `getExtractedText()` |
| `chat.py` | ai-qa-service | Added `full_content` to model + builder |
| `ai.ts` | frontend | Added `fullContent` to interface |
| `DocumentViewerModal.tsx` | frontend | Full rewrite: mark.js config, race condition fix, minimap state, cleanup |
