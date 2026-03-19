# Milestone 4: Assets, Notifications, and Export/Restore

**Scope**: Medium
**Depends on**: Milestone 3 (Admin CRUD + Approvals)
**Goal**: Build the asset library with image upload and AI generation, wire up push notifications, and implement export/restore. At the end of this milestone the parent can manage images, receive push alerts, and backup/restore the app.

---

## Tasks

### 4.1 Asset Upload and Processing

Build image upload with server-side processing via `sharp`.

**Work**:
- `packages/server/src/routes/assets.ts`:
  - `POST /api/admin/assets/upload`: multipart file upload via `multer`
  - `GET /api/admin/assets`: list assets with filters (`?source=upload|generated`, `?status=active|archived`)
  - `POST /api/admin/assets/:id/archive`: archive asset
- `packages/server/src/services/assetService.ts`:
  - `processUpload(file)`:
    1. Validate MIME type by reading file content (not just extension) — accept `image/jpeg`, `image/png`, `image/webp`
    2. Validate file size ≤ 5MB
    3. Process with `sharp`: auto-orient, resize to max 1200px on long edge (maintain aspect ratio), convert to WebP, strip metadata
    4. Generate random filename: `{uuid}.webp`
    5. Save to `/data/assets/{filename}`
    6. Insert `assets` row with metadata (source, original_filename, stored_filename, mime_type, size_bytes, width, height)
    7. Delete temp file
  - `getAssets(db, filters)`: query with optional source/status filters
  - `archiveAsset(db, id)`: set `archived_at`
- Express static serving: `express.static('/data/assets', { maxAge: '7d' })`

**Validation**:
- [ ] Uploading a JPG file: processed, stored as `.webp` in `/data/assets/`, metadata row created
- [ ] Uploading a PNG file: same processing pipeline works
- [ ] Uploading a WebP file: processed (orientation, resize) even though already WebP
- [ ] Stored filename is a UUID, not the original filename
- [ ] Original filename is preserved in the `assets` table metadata
- [ ] Image larger than 1200px on long edge is resized down
- [ ] Image smaller than 1200px is not upscaled
- [ ] EXIF orientation is fixed (rotated image displays correctly after processing)
- [ ] Metadata is stripped from the output file
- [ ] Upload > 5MB returns `422` with clear error message
- [ ] Upload of non-image file (e.g., `.txt` renamed to `.jpg`) returns `422` — MIME validated by content, not extension
- [ ] `GET /api/admin/assets` returns list of assets with metadata
- [ ] Filter `?source=upload` returns only uploaded assets
- [ ] Archiving an asset sets `archived_at`
- [ ] Archived assets still served via static route (existing references work)
- [ ] Assets served at `/assets/{filename}` with cache headers
- [ ] All asset endpoints require admin session

---

### 4.2 AI Image Generation

Integrate PPQ.ai for AI-generated images.

**Work**:
- `packages/server/src/routes/assets.ts`:
  - `POST /api/admin/assets/generate`: body `{ prompt, model? }`
- `packages/server/src/services/assetService.ts`:
  - `generateImage(prompt, model)`:
    1. Send request to PPQ.ai API with prompt and model (default: NanoBanano 2)
    2. Receive image bytes
    3. Process through same `sharp` pipeline as uploads
    4. Store with `source = 'generated'`, save prompt and model in metadata
    5. Return asset with preview URL
- Handle PPQ.ai API errors gracefully (timeout, rate limit, invalid response)

**Validation**:
- [ ] `POST /api/admin/assets/generate` with a prompt returns a generated image asset
- [ ] Generated asset has `source = 'generated'` in metadata
- [ ] Prompt and model are stored in the asset metadata
- [ ] Generated image is processed through `sharp` (same format/size as uploads)
- [ ] Default model is NanoBanano 2 when no model specified
- [ ] Specifying a different model uses that model
- [ ] When `PPQ_API_KEY` is not set, generation endpoint returns `503` with clear message
- [ ] PPQ.ai API timeout returns `502` with "generation failed" message
- [ ] PPQ.ai API error returns appropriate error (not a crash)
- [ ] Manual upload still works as fallback when generation fails
- [ ] Activity event logged for generated assets
- [ ] Generated assets appear in `GET /api/admin/assets` list
- [ ] Admin requires valid session

---

### 4.3 Asset Attachment to Entities

Wire up asset references in routines, checklist items, and rewards.

**Work**:
- Update admin CRUD endpoints to accept `image_asset_id` on:
  - Routines (`routines.image_asset_id`)
  - Checklist items (`checklist_items.image_asset_id`)
  - Rewards (`rewards.image_asset_id`)
- `packages/client/src/features/admin/`: add asset picker component to routine, checklist item, and reward forms
  - Browse existing assets
  - Upload new asset inline
  - Generate new asset inline
  - Clear/remove asset reference
- Child endpoints include asset URLs in responses

**Validation**:
- [ ] Creating a routine with `image_asset_id` stores the reference
- [ ] `GET /api/routines` includes asset URL for routines with images
- [ ] Child views display routine images where set
- [ ] Creating a checklist item with `image_asset_id` works
- [ ] Checklist view shows item images
- [ ] Creating a reward with `image_asset_id` stores the reference
- [ ] Reward cards display images
- [ ] Removing an asset reference (setting to null) clears the image
- [ ] Archiving an asset that has references: asset is archived but existing references still display the image (file still served)
- [ ] Asset picker in admin forms shows the library, allows selection, upload, or generation
- [ ] One-off vs reusable: asset `reusable` flag can be set during creation

---

### 4.4 Push Notification Infrastructure

Set up Web Push subscription management and delivery.

**Work**:
- `packages/server/src/routes/push.ts`:
  - `POST /api/push/subscribe`: body `{ role, endpoint, p256dh, auth }` — creates or updates subscription
- `packages/server/src/services/pushService.ts`:
  - `subscribe(db, { role, endpoint, keys })`: upsert by endpoint (deduplicate)
  - `sendNotification(db, role, payload)`: send to all active subscriptions for the given role
  - Handle delivery results: mark subscription `inactive` on permanent failure (410 Gone, 404)
  - Retry transient failures once
- VAPID keys loaded from `/data/secrets/webpush.json` (set up in Milestone 1)

**Validation**:
- [ ] `POST /api/push/subscribe` with role `child` creates a subscription row
- [ ] `POST /api/push/subscribe` with same endpoint updates existing row (no duplicate)
- [ ] `POST /api/push/subscribe` with role `admin` creates admin subscription
- [ ] Multiple devices can subscribe (different endpoints)
- [ ] `sendNotification` delivers to all active subscriptions for the role
- [ ] Permanent delivery failure (410) marks subscription as `inactive`
- [ ] Inactive subscriptions are not sent to on subsequent notifications
- [ ] Re-subscribing from a previously inactive device reactivates the subscription
- [ ] Push subscription endpoint works without admin session (child can subscribe)
- [ ] Push subscription endpoint with role `admin` requires admin session

---

### 4.5 Notification Triggers

Wire push notifications into the approval and submission flows.

**Work**:
- After child submission (routine completion, chore log, reward request with `requires_approval=true`): notify admin subscriptions
- After admin approval/rejection: notify child subscriptions
- Notification payloads: include type, entity name (from snapshot), and action
- Push delivery is fire-and-forget (outside the DB transaction)

**Validation**:
- [ ] Child submits routine needing approval → admin receives push notification
- [ ] Child logs chore needing approval → admin receives push notification
- [ ] Child requests reward → admin receives push notification
- [ ] Admin approves routine → child receives push notification with "approved" message
- [ ] Admin rejects chore log → child receives push notification with "rejected" message
- [ ] Admin approves reward → child receives push notification
- [ ] Push failure does NOT cause the approval/submission to fail (fire-and-forget)
- [ ] Items not requiring approval do NOT trigger admin notifications
- [ ] Notification payload includes meaningful content (e.g., "Morning Routine approved! +10 points")

---

### 4.6 Push Notification Client-Side

Build the opt-in UI and capability detection.

**Work**:
- `packages/client/src/features/child/me/NotificationOptIn.tsx`: detect push support, request permission, subscribe
- `packages/client/src/features/admin/settings/`: admin notification opt-in toggle
- `packages/client/src/lib/offline.ts`: `usePushSupport()` hook — detect if push is supported, if permission is granted/denied/default

**Validation**:
- [ ] On browsers supporting push: opt-in toggle is visible and functional
- [ ] On browsers NOT supporting push: toggle is hidden, fallback message shown
- [ ] Child opts in: browser permission prompt appears, subscription sent to server on grant
- [ ] Child denies permission: toggle shows "denied" state, no further prompts
- [ ] Admin opts in from Settings: same flow
- [ ] App does NOT prompt for notifications on first visit (opt-in only)
- [ ] When push is unavailable, in-app badges and notices still show pending counts

---

### 4.7 Export Backup

Build the backup export bundle.

**Work**:
- `packages/server/src/routes/backup.ts`:
  - `POST /api/admin/export`: creates and returns a downloadable backup bundle
- `packages/server/src/services/backupService.ts`:
  - `createExport(db)`:
    1. Create SQLite backup using `.backup()` API
    2. Bundle into a ZIP/tar:
       - `db.sqlite` backup
       - `assets/` directory contents
       - `secrets/webpush.json`
       - `manifest.json` with: app version, schema version, timezone, export timestamp
    3. Write bundle to `/data/backups/`
    4. Return the file for download
    5. Log activity event

**Validation**:
- [ ] `POST /api/admin/export` returns a downloadable file
- [ ] Bundle contains: database backup, all asset files, VAPID keys, manifest
- [ ] Manifest includes: app version, schema version (latest migration number), timezone, export timestamp
- [ ] Export creates an activity event
- [ ] Backup file is temporary (stored in `/data/backups/`, can be cleaned up)
- [ ] Large asset libraries don't cause timeout (streaming or background processing)
- [ ] Admin session required

---

### 4.8 Restore Backup

Build the backup restore flow.

**Work**:
- `packages/server/src/routes/backup.ts`:
  - `POST /api/admin/restore`: upload a backup bundle, validate, replace current data
- `packages/server/src/services/backupService.ts`:
  - `restoreBackup(bundle)`:
    1. Validate manifest: check schema version compatibility
    2. Create safety backup of current data before replacing
    3. Close current DB connection
    4. Replace `db.sqlite`, `assets/`, `secrets/` from the bundle
    5. Reopen DB, run any needed migrations (if restoring older schema)
    6. Delete all `admin_sessions` (invalidate all sessions)
    7. Log activity event (in restored DB)
    8. Return success — app is now in locked state

**Validation**:
- [ ] Uploading a valid backup bundle restores the database
- [ ] After restore, data matches the backup (routines, chores, rewards, points, etc.)
- [ ] After restore, asset files match the backup
- [ ] After restore, VAPID keys match the backup
- [ ] After restore, all admin sessions are invalidated — admin must re-enter PIN
- [ ] Safety backup is created before restore (recoverable if something goes wrong)
- [ ] Invalid/corrupt bundle returns `422` with clear error
- [ ] Incompatible schema version returns `422` with version mismatch details
- [ ] Restore is admin-only
- [ ] Activity event logged after successful restore
- [ ] Restoring and then exporting produces a functionally identical bundle

---

### 4.9 Settings Screen Completion

Finish the admin settings screen with notification and backup UI.

**Work**:
- Add to `packages/client/src/features/admin/settings/SettingsScreen.tsx`:
  - Admin push notification opt-in toggle
  - Export backup button (triggers download)
  - Restore backup upload area with confirmation dialog

**Validation**:
- [ ] Export button triggers download of backup bundle
- [ ] Restore upload area accepts file, shows confirmation dialog before proceeding
- [ ] After restore, admin is redirected to PIN entry (session invalidated)
- [ ] Admin notification toggle works (subscribes/unsubscribes)
- [ ] All settings (timezone, time slots, retention, PIN change) from Milestone 3 still work

---

### 4.10 Unit + Integration Tests — Assets, Notifications, Backup

Write automated tests for asset processing, push notifications, and export/restore.

**Work**:

**Test fixtures setup**:
- `packages/server/tests/fixtures/` — directory containing real image files for asset processing tests
  - `valid.jpg` — small valid JPEG image (< 1200px, under 5MB)
  - `valid.png` — small valid PNG image
  - `oversized.jpg` — image file > 5MB to test upload size rejection
  - `not-an-image.txt` — text file to test MIME type content validation (catches extension spoofing)
- These fixtures are used by `assetService.test.ts` to test real `sharp` processing pipelines, not mocks

**Server unit tests** (in-memory SQLite + fixtures):

- `packages/server/tests/services/assetService.test.ts`:
  - Test: `processUpload` with valid JPG creates asset record with `stored_filename` ending in `.webp`
  - Test: `processUpload` with valid PNG converts to WebP
  - Test: `processUpload` rejects file > 5MB with `ValidationError`
  - Test: `processUpload` rejects non-image file (e.g., text file with `.jpg` extension) — MIME checked by content
  - Test: `processUpload` stores randomized filename (not original)
  - Test: `processUpload` preserves `original_filename` in metadata
  - Test: `processUpload` resizes image larger than 1200px on long edge
  - Test: `processUpload` does NOT upscale small images
  - Test: `archiveAsset` sets `archived_at` timestamp
  - Test: `getAssets` filter by `source=upload` excludes generated assets
  - Test: `getAssets` filter by `status=archived` returns only archived assets

- `packages/server/tests/services/pushService.test.ts`:
  - Test: `subscribe` creates a new subscription row
  - Test: `subscribe` with same endpoint updates existing row (deduplication)
  - Test: `subscribe` with role `child` creates child subscription
  - Test: `subscribe` with role `admin` creates admin subscription
  - Test: `sendNotification` sends to all active subscriptions for the role (mock `web-push`)
  - Test: `sendNotification` skips inactive subscriptions
  - Test: permanent delivery failure (410) marks subscription as `inactive`
  - Test: re-subscribing with previously inactive endpoint reactivates it
  - Test: VAPID keys loaded correctly from file

- `packages/server/tests/services/backupService.test.ts`:
  - Test: `createExport` produces a valid ZIP/tar bundle
  - Test: bundle manifest includes app version and schema version
  - Test: bundle contains database backup file
  - Test: `restoreBackup` with valid bundle replaces database
  - Test: `restoreBackup` creates safety backup before replacing
  - Test: `restoreBackup` invalidates all admin sessions
  - Test: `restoreBackup` with incompatible schema version throws `ValidationError`
  - Test: `restoreBackup` with corrupt/invalid bundle throws `ValidationError`

**Server integration tests** (supertest):

- `packages/server/tests/routes/assets.test.ts`:
  - Test: `POST /api/admin/assets/upload` with valid image returns `201`
  - Test: `POST /api/admin/assets/upload` without admin session returns `401`
  - Test: `POST /api/admin/assets/upload` with oversized file returns `422`
  - Test: `GET /api/admin/assets` returns asset list with filters
  - Test: `POST /api/admin/assets/:id/archive` archives the asset

- `packages/server/tests/routes/push.test.ts`:
  - Test: `POST /api/push/subscribe` with role `child` works without auth
  - Test: `POST /api/push/subscribe` with role `admin` requires admin session
  - Test: subscription deduplication works via endpoint

- `packages/server/tests/routes/backup.test.ts`:
  - Test: `POST /api/admin/export` returns downloadable file
  - Test: `POST /api/admin/restore` with valid bundle returns `200`
  - Test: `POST /api/admin/restore` without admin session returns `401`

**Client component tests** (Vitest + React Testing Library + MSW):

- `packages/client/tests/features/admin/assets/AssetUpload.test.tsx`:
  - Test: file input accepts only image types
  - Test: selecting a file triggers upload
  - Test: upload success shows the new asset
  - Test: upload failure shows error message

- `packages/client/tests/features/child/me/NotificationOptIn.test.tsx`:
  - Test: when push is supported, toggle is rendered
  - Test: when push is not supported, fallback message is shown
  - Test: toggling on calls subscribe API

**Validation**:
- [ ] `npm run test -- --run` passes with all tests green
- [ ] Asset processing tests use real `sharp` with test fixture images
- [ ] Push tests mock `web-push` library (no actual push delivery)
- [ ] Backup tests create/restore real SQLite bundles
- [ ] MIME validation tested with mismatched extension/content
- [ ] All previous milestone tests still pass (no regressions)
