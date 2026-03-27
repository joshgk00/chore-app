# Milestone 4: Assets, Notifications, and Export/Restore — Implementation Plan

**Scope**: Medium (4 PRs)
**Depends on**: Milestone 3 (Admin CRUD + Approvals)
**Goal**: Deliver asset library, push notifications, and backup/restore as four right-sized PRs, each independently testable and reviewable.

---

## Resolved Discrepancies

These discrepancies between the milestone spec and the actual schema/codebase are resolved here. All PRs follow these decisions:

| Issue | Resolution |
|-------|------------|
| **`source` column values**: spec says `'generated'`, schema CHECK constraint says `'ai_generated'` | Use `'ai_generated'` — matches the schema. Update spec references accordingly. |
| **`status` column vs `?status=archived` filter**: spec filters by `?status=active\|archived` but the `status` column tracks processing state (`processing\|ready\|failed`) | The `?status=archived` filter checks `archived_at IS NOT NULL`. The `?status=active` filter checks `archived_at IS NULL AND status = 'ready'`. These are lifecycle filters, not the `status` column value. |
| **Push subscription failure marking**: spec says mark as `'inactive'`, schema CHECK constraint allows `'active'\|'expired'\|'failed'` | Use `'failed'` for permanent delivery failure (410/404). No `'inactive'` value exists in the schema. |
| **Chores table has no `image_asset_id`**: spec task 4.3 says "entities" broadly | Only `routines`, `checklist_items`, and `rewards` have `image_asset_id` FK columns. Chores do not. PR 2 scope matches schema, not the broad title. |
| **Missing activity event types for M4** | Add `'asset_uploaded'`, `'asset_generated'`, `'backup_exported'`, `'backup_restored'` to `ACTIVITY_EVENT_TYPES` in `constants.ts`. |
| **Missing shared types** | Each PR adds the interfaces it introduces. PR 1 adds asset types, PR 3 adds push types, PR 4 adds backup types. |

---

## Dependency Graph

```
PR 1 (Assets Upload + AI Generation)
  └── PR 2 (Asset Attachment to Entities)

PR 3 (Push Notifications Full Stack)  ← independent of PR 1/2

PR 4 (Backup/Restore + Settings)
  ├── depends on PR 1 (backup includes /data/assets/)
  └── depends on PR 3 (notification toggle in settings)
```

**Merge order**: PR 1 → PR 2, PR 3 (parallel with PR 2) → PR 4

---

## PR 1: Asset Upload, Processing & AI Generation (Tasks 4.1 + 4.2)

**Why combined**: Same route file, same service file. AI generation reuses the `sharp` pipeline. Splitting creates a tiny ~150-line PR that can't be tested without the upload infrastructure.

**Estimated size**: ~600 impl lines + ~500 test lines

### Dependencies to install

```bash
npm install --workspace packages/server multer sharp file-type uuid
npm install --save-dev --workspace packages/server @types/multer @types/uuid
```

> **Docker note**: `sharp` requires native binaries. Verify the Dockerfile installs build dependencies (or uses `sharp`'s prebuilt binaries for the container platform). Test the Docker build early in this PR.

### Shared types

`packages/shared/src/types.ts` — add:

```typescript
export interface Asset {
  id: number;
  source: AssetSource;
  reusable: boolean;
  status: AssetStatus;
  originalFilename: string | null;
  storedFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  prompt: string | null;
  model: string | null;
  createdAt: string;
  archivedAt: string | null;
  url?: string; // computed: `/assets/{storedFilename}`
}
```

`packages/shared/src/constants.ts` — add to `ACTIVITY_EVENT_TYPES`:
- `'asset_uploaded'`
- `'asset_generated'`

Also add asset processing constants:

```typescript
export const ASSET_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ASSET_MAX_DIMENSION = 1200; // px, long edge
export const ASSET_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
```

### Server: assetService

`packages/server/src/services/assetService.ts` — new file, factory function pattern:

```typescript
export function createAssetService(db, config, activityService) { ... }
```

Methods:

- **`processUpload(file: multer.File)`**:
  1. Read file content and validate MIME type using `file-type` (by content, not extension) — accept `image/jpeg`, `image/png`, `image/webp`
  2. Validate file size ≤ `ASSET_MAX_SIZE_BYTES` (5MB). Throw `ValidationError` if exceeded.
  3. Insert `assets` row with `status = 'processing'`, `source = 'upload'`
  4. Process with `sharp`: `.rotate()` (auto-orient), `.resize({ width: ASSET_MAX_DIMENSION, height: ASSET_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })`, `.webp()`, `.toFile(outputPath)`
  5. Read output metadata (`sharp(outputPath).metadata()`) for final `width`, `height`, `size_bytes`
  6. Generate random filename: `{uuid}.webp`
  7. Move processed file to `/data/assets/{filename}`
  8. Update `assets` row: set `stored_filename`, `mime_type = 'image/webp'`, `size_bytes`, `width`, `height`, `status = 'ready'`
  9. Delete temp file (the original upload)
  10. Record activity event (`asset_uploaded`)
  11. Return the asset row with computed `url`

  On processing failure: update `status = 'failed'`, delete temp file, throw error.

- **`generateImage(prompt: string, model?: string)`**:
  1. Check `config.imageGenApiKey` exists. If not, throw `ValidationError` with message "Image generation is not configured — set IMAGE_GEN_API_KEY" and status 503.
  2. Insert `assets` row with `status = 'processing'`, `source = 'ai_generated'`, `prompt`, `model`
  3. Send POST to PPQ.ai API with prompt and model (default: `'nanobanano-2'`)
  4. On success: write response bytes to temp file, then process through same `sharp` pipeline as uploads
  5. Update `assets` row with processed file metadata, `status = 'ready'`
  6. Record activity event (`asset_generated`)
  7. Return the asset row with computed `url`

  Error handling:
  - API timeout (use 30s AbortController): update `status = 'failed'`, return 502 with "Image generation timed out"
  - API error response: update `status = 'failed'`, return 502 with "Image generation failed"
  - Missing API key at request time: return 503 (don't insert an asset row)

- **`getAssets(filters?: { source?: AssetSource; status?: 'active' | 'archived' })`**:
  - Build query with optional WHERE clauses
  - `status=active` → `WHERE archived_at IS NULL AND status = 'ready'`
  - `status=archived` → `WHERE archived_at IS NOT NULL`
  - `source=upload` → `WHERE source = 'upload'`
  - `source=ai_generated` → `WHERE source = 'ai_generated'`
  - Return rows with computed `url` field
  - Order by `created_at DESC`

- **`archiveAsset(id: number)`**:
  - Set `archived_at = datetime('now')`. Throw `NotFoundError` if asset doesn't exist.
  - Archived assets remain served via static route (existing references work).

### Server: assets route

`packages/server/src/routes/assets.ts` — new file:

```typescript
export function createAssetRoutes(assetService) { ... }
```

Endpoints (all require admin auth — mounted under `/api/admin`):

- **`POST /assets/upload`**: `multer({ dest: tempDir, limits: { fileSize: ASSET_MAX_SIZE_BYTES } }).single('file')` → `assetService.processUpload(req.file)` → 201
- **`POST /assets/generate`**: body `{ prompt, model? }` → `assetService.generateImage(prompt, model)` → 201
- **`GET /assets`**: query `?source=upload|ai_generated&status=active|archived` → `assetService.getAssets(filters)` → 200
- **`POST /assets/:id/archive`**: → `assetService.archiveAsset(id)` → 200

Handle `multer` errors (file too large → 422).

### Server: app.ts changes

1. Create asset service: `const assetService = createAssetService(db, config, activityService);`
2. Mount asset routes: `app.use("/api/admin", createAssetRoutes(assetService));`
3. Add static serving for assets **before** the SPA catch-all, **after** the API 404 handler:

```typescript
const assetsDir = path.join(config.dataDir, "assets");
fs.mkdirSync(assetsDir, { recursive: true });
app.use("/assets", express.static(assetsDir, { maxAge: "7d" }));
```

4. Increase JSON body limit or add separate multer config (multer handles multipart, not `express.json`)

### Test fixtures

`packages/server/tests/fixtures/` — create directory with real image files:
- `valid.jpg` — small valid JPEG (< 1200px, under 5MB)
- `valid.png` — small valid PNG
- `large.jpg` — valid JPEG > 1200px on long edge (to test resize)
- `oversized.jpg` — image file > 5MB (to test size rejection)
- `not-an-image.txt` — text file (to test MIME content validation)

These can be generated programmatically in a test setup script using `sharp` itself (create a 1x1 pixel image, or a 2000x1000 image for the large case).

### Server unit tests

`packages/server/tests/services/assetService.test.ts`:
- `processUpload` with valid JPG → asset record with `stored_filename` ending in `.webp`, `status = 'ready'`
- `processUpload` with valid PNG → converts to WebP
- `processUpload` rejects file > 5MB with `ValidationError`
- `processUpload` rejects non-image file (text with `.jpg` extension) — MIME checked by content
- `processUpload` stores randomized UUID filename (not original)
- `processUpload` preserves `original_filename` in metadata
- `processUpload` resizes image larger than 1200px on long edge
- `processUpload` does NOT upscale small images
- `archiveAsset` sets `archived_at` timestamp
- `archiveAsset` with nonexistent ID throws `NotFoundError`
- `getAssets` filter by `source=upload` excludes `ai_generated` assets
- `getAssets` filter by `status=archived` returns only assets with `archived_at` set
- `getAssets` filter by `status=active` returns only assets with `archived_at IS NULL AND status = 'ready'`
- `generateImage` without API key throws `ValidationError` (503)
- `generateImage` with API timeout returns appropriate error

### Server integration tests

`packages/server/tests/routes/assets.test.ts`:
- `POST /api/admin/assets/upload` with valid image → 201 with asset data
- `POST /api/admin/assets/upload` without admin session → 401
- `POST /api/admin/assets/upload` with oversized file → 422
- `POST /api/admin/assets/upload` with non-image file → 422
- `POST /api/admin/assets/generate` with prompt → 201 (mock PPQ.ai)
- `POST /api/admin/assets/generate` without API key → 503
- `GET /api/admin/assets` returns asset list
- `GET /api/admin/assets?source=upload` filters correctly
- `POST /api/admin/assets/:id/archive` → 200
- Static serving: `GET /assets/{filename}` serves the file with cache headers

---

## PR 2: Asset Attachment to Entities (Task 4.3)

**Estimated size**: ~400 impl lines + ~250 test lines

### Scope clarification

Only three entities support `image_asset_id` per the schema:
- `routines.image_asset_id`
- `checklist_items.image_asset_id`
- `rewards.image_asset_id`

**Chores do NOT have `image_asset_id`** — the schema has no such column and no migration should add one.

### Server: update admin CRUD endpoints

Modify existing files (small changes each):

**`packages/server/src/services/routineService.ts`**:
- Accept `image_asset_id` in create/update methods
- Include `image_asset_id` in INSERT/UPDATE statements
- When returning routines (including child endpoints), compute and include `imageUrl: asset ? '/assets/' + asset.stored_filename : null`
- Join on `assets` table to get `stored_filename` when `image_asset_id` is set

**`packages/server/src/services/choreService.ts`**:
- No changes (chores have no `image_asset_id`)

**`packages/server/src/services/rewardService.ts`**:
- Accept `image_asset_id` in create/update methods
- Include asset URL in reward responses
- Join on `assets` table

**`packages/server/src/routes/admin-routines.ts`**:
- Accept `image_asset_id` in POST/PUT body validation (optional integer or null)
- Pass through to service

**`packages/server/src/routes/admin-rewards.ts`**:
- Accept `image_asset_id` in POST/PUT body validation (optional integer or null)

**`packages/server/src/routes/child.ts`**:
- Ensure bootstrap/routine/reward responses include `imageUrl` field
- Checklist items in routine responses include their `imageUrl`

### Shared types

Update existing interfaces in `packages/shared/src/types.ts`:
- `Routine` already has `imageAssetId?: number` — add `imageUrl?: string`
- `ChecklistItem` already has `imageAssetId?: number` — add `imageUrl?: string`
- `Reward` already has `imageAssetId?: number` — add `imageUrl?: string`

### Client: AssetPicker component

`packages/client/src/features/admin/assets/AssetPicker.tsx` — new file:

A reusable component for admin forms that allows:
1. Browse existing assets (calls `GET /api/admin/assets?status=active`)
2. Upload new asset inline (calls `POST /api/admin/assets/upload`)
3. Generate new asset inline (calls `POST /api/admin/assets/generate`)
4. Clear/remove asset reference (sets value to `null`)

Props: `{ value: number | null; onChange: (assetId: number | null) => void }`

UI: Shows current image thumbnail if set, with browse/upload/generate/clear actions. Use a modal or expandable panel for the asset library browser.

### Client: update admin forms

**`packages/client/src/features/admin/routines/AdminRoutineForm.tsx`**:
- Add `AssetPicker` for routine image
- Add `AssetPicker` for each checklist item image
- Send `image_asset_id` in create/update payloads

**`packages/client/src/features/admin/rewards/AdminRewardForm.tsx`**:
- Add `AssetPicker` for reward image
- Send `image_asset_id` in create/update payloads

### Client: update child views

Existing child components that render routines, checklist items, and rewards should display the `imageUrl` when present. This is a presentation-only change — show the image if `imageUrl` is truthy.

### Server unit/integration tests

`packages/server/tests/routes/admin-routines.test.ts` — add:
- Creating a routine with `image_asset_id` stores the reference
- Routine response includes `imageUrl` when asset is set
- Setting `image_asset_id` to `null` clears the image
- Invalid `image_asset_id` (nonexistent asset) returns 422

`packages/server/tests/routes/admin-rewards.test.ts` — add:
- Creating a reward with `image_asset_id` stores the reference
- Reward response includes `imageUrl`

`packages/server/tests/routes/child.test.ts` — add:
- Child bootstrap/routine response includes `imageUrl` for routines with images
- Reward cards include `imageUrl`

### Client tests

`packages/client/tests/features/admin/assets/AssetPicker.test.tsx`:
- Renders current image when value is set
- Browse shows asset library
- Upload triggers file input and calls API
- Clear sets value to null
- Generate calls generation API

---

## PR 3: Push Notifications — Full Stack (Tasks 4.4 + 4.5 + 4.6)

**Why combined**: Subscription infra alone can't be validated without triggers or client UI. These three tasks form a single deliverable feature.

**Estimated size**: ~500 impl lines + ~450 test lines

**Independent of PR 1/2** — can be developed and merged in parallel.

### Status value reconciliation

The schema defines `push_subscriptions.status` with CHECK constraint: `'active' | 'expired' | 'failed'`.

- **New subscription**: `status = 'active'`
- **Permanent delivery failure (410 Gone, 404)**: `status = 'failed'`
- **Re-subscribing from a failed device**: update `status = 'active'`, reset `updated_at`
- **Transient failure**: retry once, leave as `'active'`
- The spec's term "inactive" maps to `status = 'failed'` in code

### Server: extend pushService

`packages/server/src/services/pushService.ts` — extend existing file (currently 78 lines, VAPID key management only):

Convert to factory function pattern to accept `db`:

```typescript
export function createPushService(db, config) {
  // existing VAPID init logic moves here
  return { initVapidKeys, getVapidPublicKey, subscribe, sendNotification };
}
```

New methods:

- **`subscribe(role: PushRole, endpoint: string, keys: { p256dh: string; auth: string })`**:
  - Upsert by `endpoint` (unique constraint handles dedup)
  - If endpoint exists: update `role`, `p256dh`, `auth`, `status = 'active'`, `updated_at`
  - If endpoint is new: insert with `status = 'active'`
  - This handles re-subscribing from a previously failed device

- **`sendNotification(role: PushRole, payload: { title: string; body: string; data?: Record<string, unknown> })`**:
  - Query all subscriptions with `status = 'active'` and matching `role`
  - For each: call `webpush.sendNotification(subscription, JSON.stringify(payload))`
  - On success: update `last_success_at`
  - On permanent failure (410, 404): set `status = 'failed'`, update `last_failure_at`
  - On transient failure: retry once. If still fails, log and move on (don't mark failed).
  - Fire-and-forget — errors are caught and logged, never thrown to caller

### Server: push route

`packages/server/src/routes/push.ts` — new file:

```typescript
export function createPushRoutes(pushService, authService, config) { ... }
```

Endpoints:

- **`POST /api/push/subscribe`**: body `{ role, endpoint, p256dh, auth }`
  - Role `'child'`: no auth required
  - Role `'admin'`: requires admin session (validate via middleware)
  - Calls `pushService.subscribe(role, endpoint, { p256dh, auth })`
  - Returns 200

- **`GET /api/push/vapid-public-key`**: returns the VAPID public key (no auth, needed by client for subscription)

### Server: notification triggers (Task 4.5)

Wire `pushService.sendNotification` into existing services. All calls are **fire-and-forget** (wrapped in try-catch, outside the DB transaction):

**`packages/server/src/services/approvalService.ts`** — after successful approve/reject:
```typescript
// After the transaction commits:
try {
  if (action === 'approved') {
    pushService.sendNotification('child', {
      title: `${entityName} approved!`,
      body: pointsAwarded > 0 ? `+${pointsAwarded} points` : 'Great job!',
      data: { type: entityType, id: entityId, action: 'approved' }
    });
  } else {
    pushService.sendNotification('child', {
      title: `${entityName} needs revision`,
      body: reviewNote || 'Check with your parent',
      data: { type: entityType, id: entityId, action: 'rejected' }
    });
  }
} catch { /* log and swallow */ }
```

**`packages/server/src/services/routineService.ts`** — after submission (when `requires_approval = true`):
```typescript
try {
  pushService.sendNotification('admin', {
    title: 'Routine submitted for review',
    body: `${routineName} needs approval`,
    data: { type: 'routine_completion', id: completionId }
  });
} catch { /* log and swallow */ }
```

**`packages/server/src/services/choreService.ts`** — same pattern for chore log submissions needing approval.

**`packages/server/src/services/rewardService.ts`** — same pattern for reward requests.

> Items NOT requiring approval do NOT trigger admin notifications.

### Server: app.ts changes

1. Convert `pushService` to factory pattern: `const pushService = createPushService(db, config);`
2. Pass `pushService` to services that trigger notifications:
   - `createApprovalService(db, activityService, badgeService, pushService)`
   - `createRoutineService(db, activityService, badgeService, pushService)`
   - `createChoreService(db, activityService, badgeService, pushService)`
   - `createRewardService(db, activityService, pushService)`
3. Mount push route (outside admin auth): `app.use("/api/push", createPushRoutes(pushService, authService, config));`
   - The route itself handles auth for admin role

### Client: usePushSupport hook

`packages/client/src/lib/push.ts` — new file:

```typescript
export function usePushSupport(): {
  isSupported: boolean;
  permission: NotificationPermission | null; // 'granted' | 'denied' | 'default'
  subscribe: (role: PushRole) => Promise<void>;
}
```

- Check `'serviceWorker' in navigator && 'PushManager' in window`
- `subscribe`: request notification permission → get PushSubscription from service worker → POST to `/api/push/subscribe`
- Needs the VAPID public key from `GET /api/push/vapid-public-key`

### Client: NotificationOptIn component

`packages/client/src/features/child/me/NotificationOptIn.tsx` — new file:

- When push is supported: render a toggle
- When push is NOT supported: render a fallback message ("Notifications aren't available on this device")
- On toggle-on: call `subscribe('child')`
- If permission denied: show "Notifications are blocked. Update your browser settings to enable them."
- Never auto-prompt — opt-in only

### Client: admin notification toggle

Add to the admin settings screen (or extracted component, see PR 4 note):
- Same pattern as child opt-in but with `role = 'admin'`
- Uses `usePushSupport` hook

### Shared types

`packages/shared/src/types.ts` — add:

```typescript
export interface PushSubscribePayload {
  role: PushRole;
  endpoint: string;
  p256dh: string;
  auth: string;
}
```

### Server unit tests

`packages/server/tests/services/pushService.test.ts`:
- `subscribe` creates a new subscription row
- `subscribe` with same endpoint updates existing row (dedup)
- `subscribe` with role `'child'` creates child subscription
- `subscribe` with role `'admin'` creates admin subscription
- Re-subscribing with previously failed endpoint sets `status = 'active'`
- `sendNotification` sends to all active subscriptions for the role (mock `web-push`)
- `sendNotification` skips subscriptions with `status = 'failed'`
- Permanent delivery failure (410) sets `status = 'failed'` and `last_failure_at`
- Transient failure retries once
- `sendNotification` errors don't throw (fire-and-forget)

### Server integration tests

`packages/server/tests/routes/push.test.ts`:
- `POST /api/push/subscribe` with role `'child'` works without auth → 200
- `POST /api/push/subscribe` with role `'admin'` without session → 401
- `POST /api/push/subscribe` with role `'admin'` with session → 200
- Subscription dedup: same endpoint twice → single row
- `GET /api/push/vapid-public-key` returns a key string

### Notification trigger integration tests

Add to existing test files:
- `packages/server/tests/services/approvalService.test.ts`: after approve, `sendNotification` called with `'child'` role
- After reject, `sendNotification` called with `'child'` role
- Push failure does NOT cause approval to fail
- Items not requiring approval don't trigger notifications

### Client tests

`packages/client/tests/features/child/me/NotificationOptIn.test.tsx`:
- When push supported: toggle is rendered
- When push NOT supported: fallback message shown
- Toggle-on calls subscribe API (MSW handler)
- Permission denied shows blocked state

---

## PR 4: Export/Restore + Settings Completion (Tasks 4.7 + 4.8 + 4.9)

**Depends on**: PR 1 (backup includes `/data/assets/`), PR 3 (notification toggle in settings)

**Estimated size**: ~500 impl lines + ~350 test lines

### Dependencies to install

```bash
npm install --workspace packages/server archiver
npm install --save-dev --workspace packages/server @types/archiver
```

### Shared types and constants

`packages/shared/src/types.ts` — add:

```typescript
export interface BackupManifest {
  appVersion: string;
  schemaVersion: string; // latest migration filename, e.g. '001-initial-schema'
  timezone: string;
  exportedAt: string; // ISO 8601
}
```

`packages/shared/src/constants.ts` — add to `ACTIVITY_EVENT_TYPES`:
- `'backup_exported'`
- `'backup_restored'`

### Server: backupService

`packages/server/src/services/backupService.ts` — new file:

```typescript
export function createBackupService(db, config, activityService) { ... }
```

Methods:

- **`createExport()`**:
  1. Create backup directory: `fs.mkdirSync(path.join(config.dataDir, 'backups'), { recursive: true })`
  2. Create SQLite backup using `db.backup(backupPath)` (better-sqlite3 `.backup()` API)
  3. Create ZIP archive using `archiver`:
     - `db.sqlite` — the backup file
     - `assets/` — entire directory contents from `/data/assets/`
     - `secrets/webpush.json` — VAPID keys
     - `manifest.json` — `{ appVersion, schemaVersion, timezone, exportedAt }`
  4. Get app version from `package.json`
  5. Get schema version by reading migration filenames from the `_migrations` table
  6. Write ZIP to `/data/backups/backup-{timestamp}.zip`
  7. Record activity event (`backup_exported`)
  8. Return the file path for streaming to client
  9. Clean up: delete the temporary SQLite backup file (keep only the ZIP)

  For large asset libraries: use `archiver`'s streaming API to avoid loading everything into memory.

- **`restoreBackup(uploadedFilePath: string)`**:
  1. Extract ZIP to temp directory
  2. Read and validate `manifest.json`:
     - Check `schemaVersion` is compatible (same as or older than current). If newer, throw `ValidationError` with version mismatch details.
     - Check required fields exist
  3. Create safety backup of current data: copy `db.sqlite`, `assets/`, `secrets/` to `/data/backups/pre-restore-{timestamp}/`
  4. Close current DB connection: `db.close()`
  5. Replace files:
     - Copy `db.sqlite` from bundle to `/data/db.sqlite`
     - Replace `/data/assets/` contents with bundle's `assets/`
     - Replace `/data/secrets/webpush.json` with bundle's `secrets/webpush.json`
  6. Reopen DB connection
  7. Run any needed migrations (if restoring an older schema version)
  8. Delete all rows from `admin_sessions` (invalidate all sessions)
  9. Record activity event (`backup_restored`) in the restored DB
  10. Return success — caller should signal that the app is in locked state (admin must re-enter PIN)

  Error handling:
  - Corrupt/invalid ZIP: throw `ValidationError` with clear message
  - Missing manifest: throw `ValidationError`
  - Incompatible schema version: throw `ValidationError` with version details
  - Failure mid-restore: the safety backup exists for manual recovery. Log the error clearly.
  - Clean up temp directory on success or failure

### Server: backup route

`packages/server/src/routes/backup.ts` — new file:

```typescript
export function createBackupRoutes(backupService) { ... }
```

Endpoints (all require admin auth — mounted under `/api/admin`):

- **`POST /api/admin/export`**:
  - Calls `backupService.createExport()`
  - Streams the ZIP file as response with `Content-Disposition: attachment; filename="chore-app-backup-{timestamp}.zip"`
  - Sets `Content-Type: application/zip`

- **`POST /api/admin/restore`**:
  - `multer({ dest: tempDir, limits: { fileSize: 100 * 1024 * 1024 } }).single('backup')` (100MB limit for backups)
  - Calls `backupService.restoreBackup(req.file.path)`
  - Returns 200 with `{ data: { restored: true } }`
  - Client should clear its session and redirect to PIN entry

### Server: app.ts changes

1. Create backup service: `const backupService = createBackupService(db, config, activityService);`
2. Mount backup routes: `app.use("/api/admin", createBackupRoutes(backupService));`

> **Important**: The restore operation closes and reopens the DB. The `backupService` needs a reference it can mutate, or the app needs to restart after restore. Simplest approach: restore returns success, and the client triggers a page reload which restarts the server connection. If using a single `db` instance passed by reference, the service needs a `setDb` callback or the restore endpoint should signal the process to restart gracefully.

### Client: Settings screen extraction

`packages/client/src/features/admin/settings/SettingsScreen.tsx` is already 481 lines. Adding backup and notification UI would push it past maintainability limits.

Extract into sub-components:

- **`BackupSettings.tsx`** — new file:
  - Export button: triggers `POST /api/admin/export`, downloads the response as a file
  - Restore upload area: file input accepting `.zip`, confirmation dialog ("This will replace all data. Are you sure?"), uploads to `POST /api/admin/restore`
  - After successful restore: clear query cache, redirect to PIN entry (session was invalidated)
  - Show loading states during export/restore operations

- **`NotificationSettings.tsx`** — new file:
  - Admin push notification opt-in toggle (uses `usePushSupport` hook from PR 3)
  - Shows current permission state
  - Hidden if push is not supported

- **`SettingsScreen.tsx`** — update:
  - Import and render `<BackupSettings />` and `<NotificationSettings />` as sections
  - Existing settings (timezone, time slots, retention, PIN change) remain in place

### Server unit tests

`packages/server/tests/services/backupService.test.ts`:
- `createExport` produces a valid ZIP file
- ZIP contains `db.sqlite`, `manifest.json`
- Manifest includes `appVersion` and `schemaVersion`
- Manifest includes `timezone` and `exportedAt`
- `restoreBackup` with valid bundle replaces database
- `restoreBackup` creates safety backup before replacing
- `restoreBackup` invalidates all admin sessions (no rows in `admin_sessions`)
- `restoreBackup` with incompatible (newer) schema version throws `ValidationError`
- `restoreBackup` with corrupt/invalid ZIP throws `ValidationError`
- `restoreBackup` with missing manifest throws `ValidationError`
- Activity events recorded for both export and restore

### Server integration tests

`packages/server/tests/routes/backup.test.ts`:
- `POST /api/admin/export` returns downloadable ZIP file with correct headers
- `POST /api/admin/export` without admin session → 401
- `POST /api/admin/restore` with valid bundle → 200
- `POST /api/admin/restore` without admin session → 401
- `POST /api/admin/restore` with invalid file → 422

### Client tests

`packages/client/tests/features/admin/settings/BackupSettings.test.tsx`:
- Export button triggers download
- Restore upload shows confirmation dialog
- Confirmation proceeds with upload
- Cancel dismisses dialog without uploading
- After restore success, redirects to PIN entry

`packages/client/tests/features/admin/settings/NotificationSettings.test.tsx`:
- When push supported: toggle renders
- When push not supported: component hidden or shows fallback
- Toggle calls subscribe API

---

## Deferred Items from PR 2 Code Review

These items were identified during PR 2 review and deferred to later PRs or post-milestone cleanup.

### PR 4 Scope (address during Backup/Restore)

- **Move `Asset` type to shared package**: Add `Asset` interface to `packages/shared/src/types.ts` (already editing this file for `BackupManifest`). Update imports in `assetService.ts` and `AssetPicker.tsx` to use `import type { Asset } from "@chore-app/shared"` instead of local definitions.

- **Extract `buildAssetUrl` helper** (optional): The expression `` `/assets/${storedFilename}` `` is repeated in 6 mapper functions across `routineService.ts` and `rewardService.ts`, plus 1 in `assetService.ts`. Extract to `packages/server/src/lib/asset-url.ts` to centralize the URL convention. Small refactor (~10 lines), no behavior change.

### Post-Milestone Cleanup

- **Raw Tailwind color tokens in RoutineCard**: `border-l-sky-500 dark:border-l-sky-400` (line 28) and `border-amber-200 dark:border-amber-700` (line 61) should use CSS custom properties. Pre-existing from M2 — batch with a design token sweep across child components.

- **Add `api.postFormData()` to shared client**: `AssetPicker.tsx` uses raw `fetch` for uploads because the shared `api` client hardcodes `Content-Type: application/json`. If more upload endpoints appear, add a `postFormData` method. Low priority while assets is the only upload endpoint.

- **Extract shared test render helper**: Three admin test files (`AdminRoutineForm.test.tsx`, `AdminRewardForm.test.tsx`, `AssetPicker.test.tsx`) have near-identical `QueryClient` + `QueryClientProvider` + `MemoryRouter` wrapper boilerplate. Could extract to `packages/client/tests/helpers/render-with-providers.tsx`. Low value — self-contained duplication.
