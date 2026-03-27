# Milestone 3: Admin CRUD + Approvals

**Scope**: Large
**Depends on**: Milestone 2 (Child Flows)
**Goal**: Build admin content management, the approval queue with transactional approve/reject, remaining badge rules, and the activity/settings UI. At the end of this milestone the parent can fully manage routines, chores, and rewards, and approve or reject child submissions.

## Existing Infrastructure (from M1/M2)

Before planning, note what already exists:
- **badgeService.ts** (162 lines): `evaluateBadges()` with 5 of 8 rules (first_step, on_a_roll, week_warrior, chore_champion, point_hoarder). Already wired into submission services. Deferred: big_spender, helping_hand, solo_act.
- **settingsService.ts** (80 lines): `bootstrapSettings()`, `getAllSettings()`, `getPublicSettings()`, `getSetting()`, `setSetting()`. Fully functional.
- **activityService.ts** (80 lines): `recordActivity()`, `getRecentActivity()`. Called from submissions and badges.
- **admin.ts routes** (16 lines): Stub with `GET /api/admin/settings` only.
- **AdminLayout.tsx**: Nav already links to Dashboard, Routines, Chores, Rewards, Approvals, Settings.
- **DB schema**: All tables (routine_completions, chore_logs, reward_requests, points_ledger, badges_earned, activity_events) exist with status tracking, snapshot fields, and indexes.

---

## PR Plan

Six PRs, each self-contained with server + client + tests. Admin routes split into separate files per domain to avoid merge conflicts.

Each PR ships with unit tests (Vitest) AND E2E tests (Playwright). E2E specs live in `e2e/` following the conventions in CLAUDE.md. The full verification suite (`typecheck`, `lint`, `test --run`, `test:e2e`) must pass before merging.

### Dependency Graph

```
      ┌── PR 1 (Routines CRUD)
      ├── PR 2 (Chores CRUD)
M2 ──┤── PR 3 (Rewards CRUD)
      ├── PR 4 (Approval Queue)──── PR 5 (Remaining Badges + Ledger Admin)
      └── PR 6 (Activity Log + Settings + Logout)
```

PRs 1-3 are independent but should merge sequentially (shared admin route wiring in app.ts). PR 4 depends on M2 only. PR 5 depends on PR 4. PR 6 is independent.

**Recommended merge order**: 1 → 2 → 3 → 4 → 5 → 6

---

## PR 1: Admin Routines CRUD

Build create, read, update, and archive for routines and their checklist items.

**Server**:
- `packages/server/src/routes/adminRoutines.ts` (new file):
  - `GET /api/admin/routines`: list all routines (including archived, with `archived_at` flag)
  - `GET /api/admin/routines/:id`: single routine with checklist items
  - `POST /api/admin/routines`: create routine with checklist items
  - `PUT /api/admin/routines/:id`: update routine fields and checklist items
  - `POST /api/admin/routines/:id/archive`: set `archived_at`
  - `POST /api/admin/routines/:id/unarchive`: clear `archived_at`
- `packages/server/src/services/routineService.ts` (additions): admin CRUD methods — `createRoutine()`, `updateRoutine()`, `archiveRoutine()`, `unarchiveRoutine()`, `getRoutineAdmin()`, `listRoutinesAdmin()`
- Checklist item operations within routine create/update: add, update, archive, maintain `sort_order`
- Wire `adminRoutines` into `app.ts` behind `adminAuth` middleware

**Client**:
- `packages/client/src/features/admin/routines/AdminRoutinesList.tsx`: list with archive/unarchive toggle
- `packages/client/src/features/admin/routines/AdminRoutineForm.tsx`: form with inline checklist item editor

**Tests** (ship with this PR):
- `packages/server/tests/routes/adminRoutines.test.ts`: CRUD routes + 401 without session
- `packages/server/tests/services/routineService.test.ts` (additions): admin CRUD methods
- `packages/client/tests/features/admin/routines/AdminRoutineForm.test.tsx`: form + checklist editor

**E2E Tests** (ship with this PR):
- `e2e/admin-routines.spec.ts`: serial CRUD lifecycle (create with checklist items, edit, archive, unarchive), offline submit disabled, archived routine hidden from child

**Validation**:
- [ ] `POST /api/admin/routines` creates a routine with checklist items — returns `201`
- [ ] Created routine appears in `GET /api/routines` (child endpoint)
- [ ] `PUT /api/admin/routines/:id` updates routine name, points, time slot, etc.
- [ ] Updating a routine does NOT change snapshots on existing pending completions
- [ ] Adding/removing/reordering checklist items works within the update
- [ ] `POST /api/admin/routines/:id/archive` hides routine from child endpoints
- [ ] Archived routine still appears in `GET /api/admin/routines` (with `archived_at` set)
- [ ] Unarchiving makes the routine visible to child again
- [ ] Validation: name is required, `once_per_slot` is rejected for "Any Time" slot
- [ ] Validation: point value `0` is allowed
- [ ] All admin endpoints require valid admin session (return `401` without)
- [ ] Admin UI list shows all routines with archive status
- [ ] Admin form creates and edits routines with inline checklist items

---

## PR 2: Admin Chores CRUD

Build create, read, update, and archive for chores and their tiers.

**Server**:
- `packages/server/src/routes/adminChores.ts` (new file):
  - `GET /api/admin/chores`: list all chores with tiers
  - `POST /api/admin/chores`: create chore with tiers
  - `PUT /api/admin/chores/:id`: update chore and its tiers
  - `POST /api/admin/chores/:id/archive`: archive
  - `POST /api/admin/chores/:id/unarchive`: unarchive
- `packages/server/src/services/choreService.ts` (additions): admin CRUD methods
- Tier operations within chore create/update: add, update, archive, reorder

**Client**:
- `packages/client/src/features/admin/chores/AdminChoresList.tsx`
- `packages/client/src/features/admin/chores/AdminChoreForm.tsx`: form with inline tier editor

**Tests** (ship with this PR):
- `packages/server/tests/routes/adminChores.test.ts`
- `packages/server/tests/services/choreService.test.ts` (additions)
- `packages/client/tests/features/admin/chores/AdminChoreForm.test.tsx`

**E2E Tests** (ship with this PR):
- `e2e/admin-chores.spec.ts`: serial CRUD lifecycle (create with tiers, edit, archive, unarchive), archived chore hidden from child, offline submit disabled

**Validation**:
- [ ] Creating a chore with tiers returns `201`
- [ ] Each tier has `name`, `points`, `sort_order`, `active`
- [ ] Chore requires at least one tier
- [ ] Updating a chore's tier points does NOT affect existing pending chore log snapshots
- [ ] Archiving a chore hides it from `GET /api/chores` (child)
- [ ] Archiving a tier hides it from child chore detail but not from admin view
- [ ] Pending chore logs for archived chores remain reviewable in the approval queue
- [ ] Admin UI shows chores with tiers, supports create/edit/archive

### Cross-Domain Fixes (identified during PR 2 review)

The following pre-existing issues were found during code quality review. They don't belong in PR 2's scope but should be addressed in the listed PRs:

- **PR 1 (Routines CRUD)**: Rename `adminRoutines.test.ts` → `admin-routines.test.ts` (kebab-case per project convention). Add `autoFocus` on routine form name input.
- **PR 3 (Rewards CRUD)**: Apply same sortOrder range bounds (0-9999) pattern from PR 2 to reward routes.
- **PR 6 (Activity + Settings)**: Add admin error boundary in `AdminLayout.tsx`. Add activity events for admin CRUD operations (create/update/archive chore, routine, reward).
- **All CRUD PRs**: Consolidate duplicated route/service validation into shared helpers (e.g., `validateName()`, `validateSortOrder()`). Can be done as a follow-up after all CRUD PRs merge.

---

## PR 3: Admin Rewards CRUD

Build create, read, update, and archive for rewards. Simplest of the three CRUD PRs — rewards have no nested items (no tiers or checklist items).

**Server**:
- `packages/server/src/routes/adminRewards.ts` (new file):
  - `GET /api/admin/rewards`: list all rewards
  - `POST /api/admin/rewards`: create reward
  - `PUT /api/admin/rewards/:id`: update reward
  - `POST /api/admin/rewards/:id/archive`: archive
  - `POST /api/admin/rewards/:id/unarchive`: unarchive
- `packages/server/src/services/rewardService.ts` (additions): admin CRUD methods

**Client**:
- `packages/client/src/features/admin/rewards/AdminRewardsList.tsx`
- `packages/client/src/features/admin/rewards/AdminRewardForm.tsx`

**Tests** (ship with this PR):
- `packages/server/tests/routes/adminRewards.test.ts`
- `packages/server/tests/services/rewardService.test.ts` (additions)
- `packages/client/tests/features/admin/rewards/AdminRewardForm.test.tsx`

**E2E Tests** (ship with this PR):
- `e2e/admin-rewards.spec.ts`: serial CRUD lifecycle (create, edit, archive, unarchive), archived reward hidden from child API, 409 on editing archived reward, offline submit/archive disabled, double-click idempotency

**Validation**:
- [ ] Creating a reward returns `201`
- [ ] Reward requires `name` and `points_cost >= 0`
- [ ] Updating reward `points_cost` does NOT affect existing pending reward request `cost_snapshot`
- [ ] Archiving a reward hides it from `GET /api/rewards` (child)
- [ ] Pending reward requests for archived rewards remain reviewable
- [ ] Admin UI shows rewards with create/edit/archive

---

## PR 4: Approval Queue

Build the unified approval queue with approve/reject actions. Badge evaluation is already wired from M2 — the approval service calls the existing `evaluateBadges()` inside its transactions.

**Server**:
- `packages/server/src/services/approvalService.ts` (new file):
  - `getPendingApprovals(db)`: returns three arrays — pending routines, pending chores, pending rewards
  - `approveRoutineCompletion(db, id, note?)`: transaction — update status, create positive ledger entry, evaluate badges, log activity
  - `rejectRoutineCompletion(db, id, note?)`: transaction — update status, log activity
  - `approveChoreLog(db, id, note?)`: same pattern as routine
  - `rejectChoreLog(db, id, note?)`: same pattern
  - `approveRewardRequest(db, id, note?)`: transaction — update status, create negative ledger entry for cost_snapshot, log activity
  - `rejectRewardRequest(db, id, note?)`: transaction — update status (reservation released by status change), log activity
- `packages/server/src/routes/adminApprovals.ts` (new file):
  - `GET /api/admin/approvals`: returns grouped pending items
  - `POST /api/admin/approvals/:type/:id/approve`: body `{ note? }`
  - `POST /api/admin/approvals/:type/:id/reject`: body `{ note? }`

**Client**:
- `packages/client/src/features/admin/approvals/ApprovalsScreen.tsx`: three sections (routines, chores, rewards)
- `packages/client/src/features/admin/approvals/ApprovalCard.tsx`: snapshot data + approve/reject buttons + optional note

**Tests** (ship with this PR):
- `packages/server/tests/services/approvalService.test.ts`:
  - `approveRoutineCompletion` changes status + creates positive ledger entry matching `points_snapshot`
  - `rejectRoutineCompletion` changes status, NO ledger entry
  - Double-tap safety: approving already-approved throws `ConflictError`
  - `approveChoreLog` creates positive ledger entry
  - `rejectChoreLog` with note stores the note
  - `approveRewardRequest` creates NEGATIVE ledger entry for `cost_snapshot`
  - `rejectRewardRequest` releases reservation
  - Transaction atomicity: if badge evaluation throws, ledger entry rolls back
  - Rejecting once_per_day routine makes the window available again
- `packages/server/tests/routes/adminApprovals.test.ts`: route-level tests
- `packages/client/tests/features/admin/approvals/ApprovalCard.test.tsx`:
  - Renders snapshot data
  - Approve/reject call correct endpoints
  - Double-clicking approve only sends one request

**E2E Tests** (ship with this PR):
- `e2e/admin-approvals.spec.ts`: submit a routine/chore/reward as child, approve and reject through admin UI, verify points ledger updates, verify 409 on double-approve, verify cards removed from queue after action

**Validation**:
- [ ] `GET /api/admin/approvals` returns pending items grouped by type
- [ ] Each item shows snapshot values (name, points/cost, time slot) — not current entity values
- [ ] Approving a routine completion: status changes to `approved`, positive `points_ledger` entry created
- [ ] After routine approval, `GET /api/points/summary` shows increased `total` and `available`
- [ ] Rejecting a routine completion: status changes to `rejected`, NO ledger entry created
- [ ] Rejection note is stored and visible to child in activity feed
- [ ] Approving a chore log: same as routine — positive ledger entry
- [ ] Approving a reward request: status changes to `approved`, NEGATIVE ledger entry for `cost_snapshot` amount
- [ ] After reward approval, `reserved` points decrease (pending request no longer counted)
- [ ] Rejecting a reward request: status changes to `rejected`, reservation released
- [ ] Double-tap safety: approving/rejecting already-processed items returns `409`
- [ ] All approve/reject operations run in SQLite transactions
- [ ] Admin UI shows approval cards with snapshot data and action buttons
- [ ] After approval/rejection, the card is removed from the queue (UI updates)
- [ ] Once_per_day routine: if rejected, the child can submit again for the same day
- [ ] Approval `:type` parameter validates against `routine-completion`, `chore-log`, `reward-request`

---

## PR 5: Remaining Badges + Points Ledger Admin

Add the 3 deferred badge rules and build the admin ledger view with manual adjustments.

**Badge rules to add** (5 of 8 already exist in badgeService.ts):
- `big_spender`: ≥1 approved reward redemption
- `helping_hand`: ≥5 approved chore logs using a tier containing "help" (or a designated help flag)
- `solo_act`: ≥5 approved chore logs using a tier containing "alone" (or a designated solo flag)

**Server**:
- `packages/server/src/services/badgeService.ts` (additions): add 3 remaining badge evaluation rules
- `packages/server/src/services/pointsService.ts` (additions): `createAdjustment(db, { amount, note })` — insert ledger entry with `entry_type = 'manual'`, record activity event
- `packages/server/src/routes/adminLedger.ts` (new file):
  - `GET /api/admin/points/ledger`: paginated ledger with entry type filters
  - `POST /api/admin/points/adjust`: body `{ amount, note }` — note is required

**Client**:
- `packages/client/src/features/admin/ledger/LedgerScreen.tsx`: balance header + paginated table
- `packages/client/src/features/admin/ledger/AdjustmentForm.tsx`: amount input + required note

**Tests** (ship with this PR):
- `packages/server/tests/services/badgeService.test.ts` (additions):
  - `big_spender` earned on first approved reward
  - `helping_hand` earned with 5 help-tier chore logs
  - `solo_act` earned with 5 alone-tier chore logs
  - Badges are permanent — correcting an approval does not revoke badge
- `packages/server/tests/services/pointsService.test.ts` (additions):
  - `createAdjustment` with positive/negative amount
  - `createAdjustment` without note throws `ValidationError`
  - Negative adjustment can make `available_points` negative
  - When `available_points` is negative, new reward requests are blocked
- `packages/server/tests/routes/adminLedger.test.ts`

**E2E Tests** (ship with this PR):
- `e2e/admin-ledger.spec.ts`: create manual adjustment via admin UI, verify balance updates, verify negative adjustment blocks new reward requests, verify adjustment note required

**Validation**:
- [ ] `big_spender`: first approved reward request earns the badge
- [ ] `helping_hand` and `solo_act`: tier-based badges count correctly
- [ ] Badges are permanent — admin correcting a past approval does NOT revoke earned badges
- [ ] Newly earned badges are included in the approval response for notification purposes
- [ ] Admin ledger shows all ledger entries with type, amount, note, date
- [ ] Pagination works: first page shows latest entries
- [ ] Balance header shows total, reserved, available
- [ ] Creating a positive adjustment increases total; negative decreases total
- [ ] Adjustment without a note returns `422` validation error
- [ ] Negative adjustment can make `available_points` negative
- [ ] When `available_points` is negative, child cannot create new reward requests
- [ ] Manual adjustment creates an activity event

---

## PR 6: Activity Log + Admin Settings + Logout

Build the admin activity log with filters, settings management UI, and logout. These are the lightest remaining features — activityService and settingsService already exist, so this PR adds routes, filtering, and client UI.

**Server**:
- `packages/server/src/services/activityService.ts` (additions): `getActivityLog(db, { startDate?, endDate?, eventType?, page?, limit? })` — paginated query with optional filters
- `packages/server/src/routes/adminActivity.ts` (new file):
  - `GET /api/admin/activity-log`: paginated with `?start_date=`, `?end_date=`, `?event_type=` filters
- `packages/server/src/routes/adminSettings.ts` (new file, replaces the settings stub in admin.ts):
  - `GET /api/admin/settings`: return all settings
  - `PUT /api/admin/settings`: update settings (PIN change, timezone, time slots, retention)
- `packages/server/src/services/settingsService.ts` (additions): `updateSettings(db, updates)` — handle PIN hashing and session invalidation for PIN changes
- `packages/server/src/services/authService.ts` (additions): `invalidateAllSessions(db)` — called when PIN changes
- Remove the settings stub from `admin.ts` (or remove `admin.ts` entirely if empty)

**Client**:
- `packages/client/src/features/admin/activity/ActivityLogScreen.tsx`: table with date range picker + event type dropdown
- `packages/client/src/features/admin/settings/SettingsScreen.tsx`: forms for PIN change, timezone, time slots, retention
- Admin nav/header: visible logout button that calls `POST /api/auth/logout` and redirects to `/today`

**Tests** (ship with this PR):
- `packages/server/tests/routes/adminActivity.test.ts`: filter combinations, pagination
- `packages/server/tests/routes/adminSettings.test.ts`: settings update, PIN change + session invalidation, validation
- `packages/client/tests/features/admin/settings/SettingsScreen.test.tsx`

**E2E Tests** (ship with this PR):
- `e2e/admin-settings.spec.ts`: change admin PIN via UI, verify old PIN rejected and new PIN works, verify session invalidation forces re-login
- `e2e/admin-activity.spec.ts`: verify activity events appear after admin actions, verify date range and event type filters work
- `e2e/admin-logout.spec.ts`: logout via nav button, verify redirect to `/today`, verify `/admin/*` redirects to PIN entry

**Validation**:
- [ ] Activity log shows all tracked event types
- [ ] Date range filter works: only events within the range shown
- [ ] Event type filter works: selecting "routine_approved" shows only those
- [ ] Combined filters work: date range + event type together
- [ ] Pagination works for large activity logs
- [ ] Events include: routine submitted/approved/rejected, chore logged/approved/rejected, reward requested/approved/rejected/canceled, manual adjustment, badge unlocked
- [ ] Each event shows summary text, timestamp, and relevant entity info
- [ ] `GET /api/admin/settings` returns current settings
- [ ] `PUT /api/admin/settings` updates timezone, time slots, retention
- [ ] Changing admin PIN: new PIN hashed and stored, old PIN no longer works
- [ ] Changing admin PIN: all sessions invalidated (forced re-login)
- [ ] PIN must be at least 6 digits — shorter returns `422`
- [ ] Settings screen UI shows current values and allows editing
- [ ] All settings/activity endpoints require admin session
- [ ] Admin logout button visible in nav; destroys session and redirects to `/today`
- [ ] After logout, navigating to `/admin/*` redirects to `/admin/pin`
