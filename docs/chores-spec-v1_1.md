# Chores — Product Specification v1.1

**Version:** 1.1  
**Date:** 2026-03-17  
**Status:** Build-ready specification

---

## 1. Overview

**Chores** is a self-hosted progressive web application (PWA) for a single child (age 10-12) to track routines, log chores, earn points, and request rewards. A parent manages the experience through an admin area in the same app, protected by a PIN and automatic locking.

The app is designed to:

- run as a single Docker Compose service
- use SQLite for persistence
- support installation as an iOS home screen PWA
- support parent-managed image uploads and AI-generated images
- keep child use simple and login-free

This version closes the main product and implementation ambiguities from the original draft and is intended to be sufficient for design and development.

---

## 2. Product Goals

- Give the child a clear, engaging, low-friction way to complete daily routines
- Let the parent define routines, chores, rewards, and images without a complex admin workflow
- Make points auditable and easy to trust
- Support approval workflows for routines, chores, and rewards
- Keep the system self-hostable and easy to back up and restore

### 2.1 Non-Goals for v1

- Multiple children
- Parent accounts beyond a single admin PIN
- Child proof uploads for chores or routines
- Offline write/sync support
- Non-image file uploads

---

## 3. Core Product Decisions

The following decisions are fixed for v1:

- Child view opens with no login
- Parent-only image uploads are supported
- AI-generated images are supported, with manual upload as fallback
- Assets can be either reusable library items or one-off attachments
- Routine completion frequency is configurable per routine
- Time slot label `After School` is renamed to `Afternoon`
- Badges and streaks count only approved items
- Badges are permanent once earned
- Reward requests reserve points when submitted
- Rewards UI shows `total`, `reserved`, and `available` points, with `available` emphasized
- Parent-managed content is archived in v1 rather than hard-deleted through the UI
- Child can cancel pending chore logs and pending reward requests until review
- In-progress routine progress resumes locally on the same device only
- Offline mode is read-only
- Export and restore are built in

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Image processing | `sharp` |
| PWA | Service worker + manifest |
| Push notifications | Web Push with VAPID |
| AI image generation | PPQ.ai API |
| Containerization | Docker + Docker Compose |
| Hosting | Self-hosted behind Cloudflare Tunnel |

### 4.1 Architecture

- Single container for frontend, backend, SQLite access, asset processing, and scheduled jobs
- Single persistent data volume mounted at `/data`
- No separate object storage, Redis, or external database in v1

### 4.2 Persistent Storage Layout

`/data` contains:

- `db.sqlite` — primary SQLite database
- `assets/` — uploaded and AI-generated images
- `secrets/` — generated VAPID keys and any app-generated secret material
- `backups/` — temporary export bundles created by the app

---

## 5. Deployment & Configuration

### 5.1 Docker Compose

The app is deployed from a single `docker-compose.yml` file and a single app container.

### 5.2 Environment Variables

```env
PUBLIC_ORIGIN=https://chores.example.com
PORT=3000
TZ=America/New_York
INITIAL_ADMIN_PIN=123456
PPQ_API_KEY=<ppq.ai-api-key>
ACTIVITY_RETENTION_DAYS_DEFAULT=365
DATA_DIR=/data
```

### 5.3 Configuration Rules

- `PUBLIC_ORIGIN` is required and is the canonical HTTPS origin used by the app, service worker, manifest, and push setup
- `TZ` defines the default household timezone and is used to initialize the in-app timezone setting
- `INITIAL_ADMIN_PIN` is used only on first boot when no admin PIN has been initialized yet
- After first boot, the admin PIN is stored only as a secure hash in the database
- `ACTIVITY_RETENTION_DAYS_DEFAULT` initializes the retention setting only on first run

### 5.4 Generated Secrets

- VAPID keys are generated on first run if not already present
- Generated VAPID keys are stored in `/data/secrets/webpush.json`
- The app does not rewrite the `.env` file at runtime

### 5.5 Cloudflare Tunnel

- Cloudflare Tunnel forwards HTTPS traffic to the app container on `localhost:3000`
- Express must trust the reverse proxy so secure cookies and request origin handling work correctly
- The app does not auto-detect its origin at runtime; it uses `PUBLIC_ORIGIN`

---

## 6. Authentication & Access Control

### 6.1 Child Access

- The child view is intentionally login-free
- Public child endpoints are accessible to anyone who can reach the app URL
- This is an explicit v1 trade-off for simplicity
- If stronger perimeter security is needed later, Cloudflare Access or a lightweight child device gate can be added outside v1

### 6.2 Admin Access

- Admin mode is accessed from a small `Admin` entry point in the app footer
- Parent enters a PIN to unlock admin mode
- The server creates a signed admin session and stores it in a secure, HTTP-only, same-site cookie
- Admin UI state may also keep a client-side unlocked flag for UX, but API authorization is based on the secure cookie

### 6.3 Admin Session Rules

- Minimum PIN length: 6 digits
- Admin session expires after 10 minutes of inactivity
- If the app is backgrounded for more than 1 minute while in admin mode, the UI locks and requires PIN re-entry
- Manual lock is available from the admin UI
- All admin sessions are invalidated on PIN change and on restore

### 6.4 PIN Throttling

- After 5 failed PIN attempts from the same IP within a rolling 15-minute window, the PIN endpoint enters cooldown
- Cooldown increases with repeated failed bursts
- The app returns a generic error message and never reveals whether the PIN format or value was incorrect

### 6.5 Authorization Rules

- Child endpoints require no auth
- Admin endpoints require a valid admin session
- Admin-only mutations are rejected with `401` or `403`

---

## 7. Child Experience

### 7.1 Navigation

The child view has four tabs:

1. **Today**
2. **Routines**
3. **Rewards**
4. **Me**

### 7.2 Today Screen

The Today screen is the default landing screen and shows:

- time-aware routine cards
- any pending routine, chore, or reward items awaiting review
- mascot greeting
- quick action to log a chore

### 7.3 Time Slots

Default global time slot windows:

| Slot | Default window |
|---|---|
| Morning | 5:00 AM - 10:59 AM |
| Afternoon | 3:00 PM - 6:29 PM |
| Bedtime | 6:30 PM - 9:30 PM |
| Any Time | Always visible |

Rules:

- Time slot windows are global settings editable by the parent
- All date and time logic uses the household timezone setting
- Weekend and school-break behavior is identical to weekday behavior in v1

### 7.4 Routine Model

Each routine has:

- name
- time slot
- point value
- `requiresApproval`
- `randomizeItems`
- optional image
- `completionRule`
- `active`

`completionRule` values:

- `once_per_day`
- `once_per_slot`
- `unlimited`

Validation:

- `once_per_slot` is allowed only for `Morning`, `Afternoon`, or `Bedtime`
- `Any Time` routines may use `once_per_day` or `unlimited`

### 7.5 Routine Checklist Flow

When the child opens a routine:

1. A full-screen checklist opens
2. The app creates a local draft in IndexedDB for that routine session
3. If randomization is enabled, the checklist order is shuffled once at session start and stored in the draft
4. The child can check and uncheck items locally until submission
5. If the app is closed or refreshed on the same device, the local draft resumes
6. Drafts do not sync across devices and are never stored on the server before completion

### 7.6 Routine Completion Rules

- A completion submission includes an idempotency key
- For `once_per_day` and `once_per_slot` routines, an existing pending or approved completion blocks another completion in the same window
- If a pending completion is later rejected, the routine becomes available again if the relevant window has not yet ended
- On submit, the server stores snapshot values for the routine and checklist state used for that completion
- If approval is not required, points are awarded immediately
- If approval is required, the completion enters the approvals queue

### 7.7 Chore Logging

The child can log a one-off chore from Today or Routines:

1. Select a chore
2. Select a tier
3. Submit with idempotency key

Rules:

- Chores may be logged multiple times unless the parent models them differently
- Chore proof photos or file attachments are not supported in v1
- If the chore requires approval, it enters the queue
- If not, points are awarded immediately
- A pending chore log can be canceled by the child until review

### 7.8 Rewards

Each reward card shows:

- name
- optional image
- point cost
- progress based on `available points`
- request status if already pending

Displayed balances:

- `Total points`
- `Reserved points`
- `Available points`

`Available points = total approved ledger balance - sum of all pending reward request cost snapshots`

Reward request rules:

- Submitting a reward request reserves points immediately
- Multiple pending reward requests are allowed only if available points remain sufficient
- A pending request can be canceled by the child until review
- On rejection or cancellation, the reservation is released
- On approval, the reserved request becomes a real negative ledger entry

### 7.9 Me Screen

The Me screen shows:

- available points prominently
- total and reserved points as secondary values
- badge collection
- mascot mood/state
- recent activity
- child notification preferences entry point

---

## 8. Mascot & Gamification

### 8.1 Mascot States

| State | Trigger |
|---|---|
| Greeting | Default time-based greeting |
| Happy | Approved routine/chore points earned |
| Celebrating | Badge unlocked or reward approved |
| Waiting | Pending approvals exist |
| Encouraging | Routine started but not finished |
| Sleeping | Bedtime slot or long inactivity |

The mascot is implemented as inline SVG.

### 8.2 Badge Rules

Initial badge set:

| Badge | Trigger |
|---|---|
| First step | First approved routine completion |
| On a roll | Approved routine completion 3 days in a row |
| Week warrior | At least one approved routine completion on 7 consecutive days |
| Chore champion | 10 approved chore logs |
| Big spender | First approved reward redemption |
| Point hoarder | 100 total approved points available at once |
| Helping hand | 5 approved chore logs using a help tier |
| Solo act | 5 approved chore logs using an alone tier |

Badge rules:

- Only approved events count
- Badges are awarded once and never revoked
- If a previously approved item is later corrected by an admin action, already-earned badges remain earned

### 8.3 Streak Rules

- Streak logic uses the household timezone
- Streaks are based on approved routine completions only
- Streak badges are permanent once unlocked
- A future live streak counter may recalculate from approved history, but badge ownership does not change

---

## 9. Points, Ledger, and Reservations

### 9.1 Source of Truth

- `points_ledger` is the source of truth for approved earned/spent/adjusted points
- Pending reward reservations are not ledger entries
- Reserved points are derived from pending reward requests

### 9.2 Balance Definitions

- `total_points`: sum of all ledger entries
- `reserved_points`: sum of all pending reward request cost snapshots
- `available_points`: `total_points - reserved_points`

### 9.3 Earning Points

Points are earned from:

- routine completions
- chore logs
- manual positive adjustments

### 9.4 Spending Points

Points are spent from:

- approved reward requests
- manual negative adjustments

### 9.5 Adjustment Rules

- Manual adjustments require a note
- Negative adjustments are allowed
- Negative adjustments may cause `available_points` to become negative if points were already reserved by pending rewards
- If `available_points` is negative, no new reward requests may be created until it is non-negative again
- Existing pending reward requests remain reviewable

### 9.6 Transaction Rules

The following operations must run in SQLite transactions:

- creating a reward request and reserving points
- approving or rejecting any pending routine, chore, or reward item
- creating manual adjustments
- restoring a backup

All transaction-based mutations must be idempotent and safe against double-submit.

---

## 10. Approval Workflow

### 10.1 Approval Queue

The admin Approvals screen contains three sections:

1. Pending routine completions
2. Pending chore logs
3. Pending reward requests

Each queue item shows:

- snapshot name/title
- submission time
- point value or reward cost snapshot
- current status
- optional child note if applicable
- Approve / Reject actions

### 10.2 Approval Result Rules

#### Routine completion

- `Approve`: mark approved, create positive ledger entry, evaluate badges, notify child
- `Reject`: mark rejected, optional note visible to child, notify child

#### Chore log

- `Approve`: mark approved, create positive ledger entry, evaluate badges, notify child
- `Reject`: mark rejected, optional note visible to child, notify child

#### Reward request

- `Approve`: mark approved, create negative ledger entry for the reserved cost snapshot, notify child
- `Reject`: mark rejected, release reservation, optional note visible to child, notify child

### 10.3 Child Cancellation Rules

- Pending chore logs may be canceled by the child until reviewed
- Pending reward requests may be canceled by the child until reviewed
- Pending routine completions may not be canceled by the child in v1

### 10.4 Snapshot Rules

Pending and historical records must store the relevant snapshot values at submission time, including:

- routine name
- routine points
- routine approval requirement
- routine time slot
- randomized checklist order and checklist labels
- chore name
- chore tier name
- chore points
- reward name
- reward cost

Parent edits after submission do not alter the historical snapshot.

---

## 11. Admin Experience

### 11.1 Navigation

Admin view contains:

1. Routines
2. Chores
3. Rewards
4. Approvals
5. Points Ledger
6. Activity Log
7. Asset Library
8. Settings

### 11.2 Routines Management

Each routine has:

| Field | Type | Notes |
|---|---|---|
| Name | String | Required |
| Time slot | Enum | Morning, Afternoon, Bedtime, Any Time |
| Completion rule | Enum | once_per_day, once_per_slot, unlimited |
| Point value | Integer | 0 allowed |
| Requires approval | Boolean | Default false |
| Randomize items | Boolean | Shuffle at session start |
| Image asset | Asset ref | Optional |
| Active | Boolean | Hidden from child when false |

Checklist items have:

| Field | Type | Notes |
|---|---|---|
| Label | String | Required |
| Image asset | Asset ref | Optional |
| Sort order | Integer | Used unless randomization is on |
| Active | Boolean | Archived items hidden from new sessions |

### 11.3 Chores Management

Each chore has:

- name
- `requiresApproval`
- `active`
- one or more tiers

Each tier has:

- tier name
- point value
- sort order
- `active`

### 11.4 Rewards Management

Each reward has:

- name
- point cost
- optional image asset
- `active`

### 11.5 Asset Library

The asset system replaces the original generator-only concept.

Capabilities:

- upload image
- generate image via AI
- browse library
- search/filter by source
- attach reusable asset to a routine, checklist item, or reward
- create one-off asset attached to a single entity
- archive asset

Rules:

- parent-only access
- images only in v1
- supported input formats: JPG, PNG, WebP
- max upload size: 5 MB
- uploads are processed server-side to fix orientation and resize/compress if needed
- server stores randomized filenames rather than user-provided names
- metadata includes source, original filename, mime type, dimensions, file size, created time, prompt, and model where applicable
- assets with references are archived rather than hard-deleted in the UI
- unreferenced archived assets may be permanently purged by a future maintenance task, but no end-user hard delete UI is required in v1

### 11.6 AI Image Generation

AI generation flow:

1. Parent enters prompt
2. Parent selects model, with NanoBanano 2 as default
3. Backend sends request to PPQ.ai
4. Generated preview is shown
5. Parent accepts as reusable or one-off asset

Fallback:

- If generation fails or is unavailable, manual upload remains fully supported

### 11.7 Points Ledger

Displays:

- total balance
- reserved points
- available points
- paginated ledger entries
- add-adjustment form

Ledger entry types:

- routine
- chore
- reward
- manual

### 11.8 Activity Log

The activity log is a convenience view, not the accounting source of truth.

Trackable events include:

- routine submitted
- routine approved
- routine rejected
- chore logged
- chore approved
- chore rejected
- reward requested
- reward approved
- reward rejected
- reward canceled
- manual adjustment
- badge unlocked
- asset uploaded
- asset generated
- export created
- restore completed

Filters:

- date range
- event type

Retention:

- activity log rows may be purged after the configured retention period
- canonical history tables and points ledger are never purged by the retention job

### 11.9 Settings

Settings screen includes:

- change admin PIN
- household timezone
- time slot window definitions
- activity retention days
- child push notification opt-in
- admin push notification opt-in
- export backup
- restore backup

---

## 12. Notifications

### 12.1 Notification Types

Admin notifications:

- routine completion awaiting approval
- chore log awaiting approval
- reward request awaiting approval

Child notifications:

- routine approved
- routine rejected
- chore approved
- chore rejected
- reward approved
- reward rejected

### 12.2 Subscription UX

- Notifications are opt-in from settings-style screens
- Child notification opt-in is reached from the Me screen
- Admin notification opt-in is in Admin Settings
- The app does not prompt for notifications on first visit

### 12.3 Capability Detection

- The app must detect whether push is supported in the current browser and context
- If push is unavailable, denied, or unsupported, the app falls back to in-app badges and notices

### 12.4 Subscription Lifecycle

- Multiple devices may subscribe
- Subscriptions are deduplicated by endpoint
- Invalid subscriptions are marked inactive when push delivery returns permanent failure
- Devices can re-subscribe later without creating duplicates

---

## 13. PWA & Offline Behavior

### 13.1 PWA Requirements

- `manifest.json` uses `display: standalone`
- app icons include at least `192x192` and `512x512`
- app is optimized for tablet first, phone second
- touch targets are at least `44x44`

### 13.2 Service Worker Strategy

The service worker:

- caches the app shell
- may cache the latest successful read responses needed for child read-only views
- does not queue mutations for background sync in v1

### 13.3 Offline Rules

- Offline mode is read-only
- Child may browse the app shell and any cached read data
- Mutations fail cleanly with an offline message
- Admin mode is not required to support full offline management in v1

---

## 14. Data Model

### 14.1 Primary Tables

- `routines`
  - `id`, `name`, `time_slot`, `completion_rule`, `points`, `requires_approval`, `image_asset_id`, `randomize_items`, `active`, `sort_order`, `created_at`, `updated_at`, `archived_at`
- `checklist_items`
  - `id`, `routine_id`, `label`, `image_asset_id`, `sort_order`, `active`, `created_at`, `updated_at`, `archived_at`
- `chores`
  - `id`, `name`, `requires_approval`, `active`, `sort_order`, `created_at`, `updated_at`, `archived_at`
- `chore_tiers`
  - `id`, `chore_id`, `name`, `points`, `sort_order`, `active`, `created_at`, `updated_at`, `archived_at`
- `rewards`
  - `id`, `name`, `points_cost`, `image_asset_id`, `active`, `sort_order`, `created_at`, `updated_at`, `archived_at`
- `assets`
  - `id`, `source`, `reusable`, `status`, `original_filename`, `stored_filename`, `mime_type`, `size_bytes`, `width`, `height`, `prompt`, `model`, `created_at`, `archived_at`
- `routine_completions`
  - `id`, `routine_id`, `routine_name_snapshot`, `time_slot_snapshot`, `completion_rule_snapshot`, `points_snapshot`, `requires_approval_snapshot`, `checklist_snapshot_json`, `randomized_order_json`, `completion_window_key`, `completed_at`, `local_date`, `status`, `review_note`, `reviewed_at`, `idempotency_key`
- `chore_logs`
  - `id`, `chore_id`, `chore_name_snapshot`, `tier_id`, `tier_name_snapshot`, `points_snapshot`, `requires_approval_snapshot`, `logged_at`, `local_date`, `status`, `review_note`, `reviewed_at`, `idempotency_key`
- `reward_requests`
  - `id`, `reward_id`, `reward_name_snapshot`, `cost_snapshot`, `requested_at`, `local_date`, `status`, `review_note`, `reviewed_at`, `canceled_at`, `idempotency_key`
- `points_ledger`
  - `id`, `entry_type`, `reference_table`, `reference_id`, `amount`, `note`, `created_at`
- `badges_earned`
  - `id`, `badge_key`, `earned_at`
- `push_subscriptions`
  - `id`, `role`, `endpoint`, `p256dh`, `auth`, `status`, `created_at`, `updated_at`, `last_success_at`, `last_failure_at`
- `admin_sessions`
  - `id`, `token_hash`, `created_at`, `last_seen_at`, `expires_at`
- `settings`
  - `key`, `value`
- `activity_events`
  - `id`, `event_type`, `entity_type`, `entity_id`, `summary`, `metadata_json`, `created_at`

### 14.2 Constraints & Indexing

Required constraints:

- foreign keys enabled
- status fields constrained to valid enums
- non-negative reward costs
- unique `badge_key` in `badges_earned`
- unique `endpoint` in `push_subscriptions`
- unique `idempotency_key` per mutation table where applicable

Required indexes:

- approval queue status fields
- created timestamps for logs and feeds
- reward request status and date
- points ledger date

---

## 15. API Surface

All endpoints are under `/api`.

### 15.1 Response Contract

Successful responses:

```json
{ "data": { } }
```

Error responses:

```json
{
  "error": {
    "code": "string_code",
    "message": "Human readable message",
    "fieldErrors": {}
  }
}
```

### 15.2 Child Endpoints

- `GET /api/app/bootstrap`
  - child-facing summary data used to render Today/Me quickly
- `GET /api/routines`
- `GET /api/routines/:id`
- `POST /api/routine-completions`
- `GET /api/chores`
- `POST /api/chore-logs`
- `POST /api/chore-logs/:id/cancel`
- `GET /api/rewards`
- `POST /api/reward-requests`
- `POST /api/reward-requests/:id/cancel`
- `GET /api/points/summary`
  - returns total, reserved, available
- `GET /api/points/ledger`
- `GET /api/badges`
- `GET /api/activity/recent`
- `POST /api/push/subscribe`
  - role = child

### 15.3 Auth Endpoints

- `POST /api/auth/verify`
- `GET /api/auth/session`
- `POST /api/auth/lock`
- `POST /api/auth/logout`

### 15.4 Admin Endpoints

- CRUD for `/api/admin/routines`
- CRUD for `/api/admin/chores`
- CRUD for `/api/admin/rewards`
- `GET /api/admin/approvals`
- `POST /api/admin/approvals/:type/:id/approve`
- `POST /api/admin/approvals/:type/:id/reject`
- `GET /api/admin/points/ledger`
- `POST /api/admin/points/adjust`
- `GET /api/admin/activity-log`
- `GET /api/admin/assets`
- `POST /api/admin/assets/upload`
- `POST /api/admin/assets/generate`
- `POST /api/admin/assets/:id/archive`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `POST /api/admin/export`
- `POST /api/admin/restore`
- `POST /api/push/subscribe`
  - role = admin

### 15.5 Status Codes

- `200` / `201` for success
- `400` for malformed requests
- `401` for missing auth
- `403` for forbidden actions
- `404` for missing resource
- `409` for conflicts such as duplicate completion window, archived item, or insufficient available points
- `422` for validation errors

---

## 16. Backup, Restore, and Operations

### 16.1 Export Backup

Admin can create a downloadable backup bundle from Settings.

Bundle contents:

- SQLite backup file
- `assets/` directory
- generated VAPID key material from `secrets/`
- manifest file containing app version, schema version, timezone, and export timestamp

### 16.2 Restore Backup

Restore flow:

1. Admin uploads a backup bundle
2. App validates manifest and compatibility
3. App creates a safety backup before replacing current data
4. DB, assets, and secrets are restored
5. Existing admin sessions are invalidated
6. App returns to a locked state

Rules:

- Restore is admin-only and requires explicit confirmation
- Restore is destructive to current data
- Push subscriptions may need re-validation after restore even if preserved

### 16.3 Logging & Observability

The app should log:

- startup and migration status
- backup and restore outcomes
- asset upload and processing failures
- AI generation failures
- push delivery failures
- auth throttling events

---

## 17. Edge-Case Rules

### 17.1 Archive Behavior

- Archived routines, chores, rewards, tiers, and assets are hidden from new child actions
- Archived records remain fully referenceable in historical views and snapshots
- Pending items tied to archived records remain reviewable

### 17.2 Editing After Submission

- Parent edits never rewrite pending or historical snapshots
- Approval UI always shows snapshot values captured at submission time

### 17.3 Idempotency

The client must send idempotency keys for:

- routine completion submit
- chore log submit
- reward request submit

The server must safely treat retried submissions as the same logical action.

### 17.4 Double Tap / Retry Safety

- Repeated child taps must not create duplicate pending items
- Repeated admin approval taps must not create duplicate ledger entries

### 17.5 Unsupported Push

- If push is not supported, the app still functions fully using in-app status badges, queue counts, and notices

### 17.6 Security & Sanitization

- All notes and labels are treated as plain text and escaped in the UI
- Uploaded files are validated by MIME type and content processing, not extension only
- Images are served from randomized filenames

---

## 18. Build Order

1. Scaffold app, Docker, database, and migrations
2. Implement auth/session, admin locking, and settings bootstrap
3. Build child read flows: Today, Routines, Rewards, Me
4. Build routine local draft/resume flow
5. Build chore and reward submission flows with idempotency
6. Build points summary, ledger, and reservation logic
7. Build admin CRUD for routines, chores, rewards
8. Build unified approvals queue with transactional approvals
9. Build asset library with upload and AI generation
10. Build notifications and subscription management
11. Build export/restore
12. Add polish: mascot states, badges, animations, retention job

---

## 19. Success Criteria

The v1 build is considered complete when:

- Parent can fully manage routines, chores, rewards, and images
- Child can complete routines, log chores, and request rewards without ambiguity
- Points remain internally consistent under retries and concurrent approvals
- Pending rewards reserve points correctly
- Historical views preserve original snapshot data
- Admin sessions lock automatically and resist brute-force PIN guessing
- Backups can be exported and restored successfully
- The app remains usable as a PWA with clean read-only offline behavior
