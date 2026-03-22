# Milestone 3: Admin CRUD + Approvals

**Scope**: Large
**Depends on**: Milestone 2 (Child Flows)
**Goal**: Build admin content management, the approval queue with transactional approve/reject, badge evaluation, and the activity log. At the end of this milestone the parent can fully manage routines, chores, and rewards, and approve or reject child submissions.

---

## Tasks

### 3.1 Admin Routines CRUD

Build create, read, update, and archive for routines and their checklist items.

**Work**:
- `packages/server/src/routes/admin.ts`:
  - `GET /api/admin/routines`: list all routines (including archived, with `archived_at` flag)
  - `GET /api/admin/routines/:id`: single routine with checklist items
  - `POST /api/admin/routines`: create routine with checklist items
  - `PUT /api/admin/routines/:id`: update routine fields and checklist items
  - `POST /api/admin/routines/:id/archive`: set `archived_at`
  - `POST /api/admin/routines/:id/unarchive`: clear `archived_at`
- Checklist item operations within routine create/update:
  - Add new items, update existing items, archive items
  - Maintain `sort_order`
- `packages/client/src/features/admin/routines/AdminRoutinesList.tsx`: list with archive/unarchive toggle
- `packages/client/src/features/admin/routines/AdminRoutineForm.tsx`: form with inline checklist item editor

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

### 3.2 Admin Chores CRUD

Build create, read, update, and archive for chores and their tiers.

**Work**:
- `packages/server/src/routes/admin.ts`:
  - `GET /api/admin/chores`: list all chores with tiers
  - `POST /api/admin/chores`: create chore with tiers
  - `PUT /api/admin/chores/:id`: update chore and its tiers
  - `POST /api/admin/chores/:id/archive`: archive
  - `POST /api/admin/chores/:id/unarchive`: unarchive
- Tier operations within chore create/update: add, update, archive, reorder
- `packages/client/src/features/admin/chores/AdminChoresList.tsx`
- `packages/client/src/features/admin/chores/AdminChoreForm.tsx`: form with inline tier editor

**Validation**:
- [ ] Creating a chore with tiers returns `201`
- [ ] Each tier has `name`, `points`, `sort_order`, `active`
- [ ] Chore requires at least one tier
- [ ] Updating a chore's tier points does NOT affect existing pending chore log snapshots
- [ ] Archiving a chore hides it from `GET /api/chores` (child)
- [ ] Archiving a tier hides it from child chore detail but not from admin view
- [ ] Pending chore logs for archived chores remain reviewable in the approval queue
- [ ] Admin UI shows chores with tiers, supports create/edit/archive

---

### 3.3 Admin Rewards CRUD

Build create, read, update, and archive for rewards.

**Work**:
- `packages/server/src/routes/admin.ts`:
  - `GET /api/admin/rewards`: list all rewards
  - `POST /api/admin/rewards`: create reward
  - `PUT /api/admin/rewards/:id`: update reward
  - `POST /api/admin/rewards/:id/archive`: archive
  - `POST /api/admin/rewards/:id/unarchive`: unarchive
- `packages/client/src/features/admin/rewards/AdminRewardsList.tsx`
- `packages/client/src/features/admin/rewards/AdminRewardForm.tsx`

**Validation**:
- [ ] Creating a reward returns `201`
- [ ] Reward requires `name` and `points_cost >= 0`
- [ ] Updating reward `points_cost` does NOT affect existing pending reward request `cost_snapshot`
- [ ] Archiving a reward hides it from `GET /api/rewards` (child)
- [ ] Pending reward requests for archived rewards remain reviewable
- [ ] Admin UI shows rewards with create/edit/archive

---

### 3.4 Approval Queue

Build the unified approval queue with approve/reject actions.

**Work**:
- `packages/server/src/routes/admin.ts`:
  - `GET /api/admin/approvals`: returns three arrays — pending routines, pending chores, pending rewards
  - `POST /api/admin/approvals/:type/:id/approve`: body `{ note? }`
  - `POST /api/admin/approvals/:type/:id/reject`: body `{ note? }`
- `packages/server/src/services/approvalService.ts`:
  - `approveRoutineCompletion(db, id, note?)`: transaction — update status, create positive ledger entry, evaluate badges, log activity
  - `rejectRoutineCompletion(db, id, note?)`: transaction — update status, log activity
  - `approveChoreLog(db, id, note?)`: same pattern as routine
  - `rejectChoreLog(db, id, note?)`: same pattern
  - `approveRewardRequest(db, id, note?)`: transaction — update status, create negative ledger entry for cost_snapshot, log activity
  - `rejectRewardRequest(db, id, note?)`: transaction — update status (reservation released by status change), log activity
- `packages/client/src/features/admin/approvals/ApprovalsScreen.tsx`: three sections
- `packages/client/src/features/admin/approvals/ApprovalCard.tsx`: snapshot data + approve/reject buttons + optional note

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
- [ ] Rejecting a reward request: status changes to `rejected`, reservation released (`reserved` decreases, `available` increases)
- [ ] Double-tap safety: approving an already-approved item returns `409` (not a duplicate ledger entry)
- [ ] Double-tap safety: rejecting an already-rejected item returns `409`
- [ ] All approve/reject operations run in SQLite transactions
- [ ] Admin UI shows approval cards with snapshot data and action buttons
- [ ] After approval/rejection, the card is removed from the queue (UI updates)
- [ ] Once_per_day routine: if rejected, the child can submit again for the same day
- [ ] Approval `:type` parameter validates against `routine-completion`, `chore-log`, `reward-request`

---

### 3.5 Badge Evaluation Engine

Implement the 8 badge rules that run after every approval.

**Work**:
- `packages/server/src/services/badgeService.ts`:
  - `evaluate(db)`: check all badge rules, insert newly earned badges, return list of new badges
  - Badge rules (all count only `approved` items):
    1. `first_step`: ≥1 approved routine completion
    2. `on_a_roll`: approved routine completions on 3 consecutive days
    3. `week_warrior`: ≥1 approved routine completion on each of 7 consecutive days
    4. `chore_champion`: ≥10 approved chore logs
    5. `big_spender`: ≥1 approved reward redemption
    6. `point_hoarder`: available points ≥ 100 at evaluation time
    7. `helping_hand`: ≥5 approved chore logs using a tier containing "help" (or a designated help flag)
    8. `solo_act`: ≥5 approved chore logs using a tier containing "alone" (or a designated solo flag)
- Badge evaluation is called inside approval transactions
- `badges_earned` has `UNIQUE` on `badge_key` — duplicate insert is a no-op

**Validation**:
- [ ] First approved routine completion earns `first_step` badge
- [ ] Second approved routine completion does NOT re-earn `first_step` (already earned)
- [ ] `on_a_roll`: approved routine completions on 3 consecutive `local_date` values earns the badge
- [ ] `on_a_roll`: a gap day breaks the streak — badge not earned with days 1, 2, 4
- [ ] `week_warrior`: 7 consecutive days with at least one approved routine each day
- [ ] `chore_champion`: exactly 10 approved chore logs triggers the badge
- [ ] `big_spender`: first approved reward request earns the badge
- [ ] `point_hoarder`: available points reaching 100 earns the badge (even if they drop below later)
- [ ] `helping_hand` and `solo_act`: tier-based badges count correctly
- [ ] Badges are permanent — admin correcting a past approval does NOT revoke earned badges
- [ ] `GET /api/badges` returns all earned badges with `earned_at` timestamps
- [ ] Newly earned badges are included in the approval response for notification purposes
- [ ] Streak logic uses the household timezone (not UTC) for day boundaries

---

### 3.6 Points Ledger Admin View

Build the admin-facing ledger view with manual adjustments.

**Work**:
- `packages/server/src/routes/admin.ts`:
  - `GET /api/admin/points/ledger`: paginated ledger with entry type filters
  - `POST /api/admin/points/adjust`: body `{ amount, note }` — note is required
- `packages/server/src/services/pointsService.ts`: `createAdjustment(db, { amount, note })`: insert ledger entry with `entry_type = 'manual'`
- `packages/client/src/features/admin/ledger/LedgerScreen.tsx`: balance header + paginated table
- `packages/client/src/features/admin/ledger/AdjustmentForm.tsx`: amount input + required note

**Validation**:
- [ ] Admin ledger shows all ledger entries with type, amount, note, date
- [ ] Pagination works: first page shows latest entries
- [ ] Balance header shows total, reserved, available
- [ ] Creating a positive adjustment: ledger entry created, total increases
- [ ] Creating a negative adjustment: ledger entry created, total decreases
- [ ] Adjustment without a note returns `422` validation error
- [ ] Negative adjustment can make `available_points` negative
- [ ] When `available_points` is negative, child cannot create new reward requests
- [ ] Existing pending reward requests remain reviewable when available is negative
- [ ] Manual adjustment creates an activity event

---

### 3.7 Activity Log

Build the admin activity log with filters.

**Work**:
- `packages/server/src/routes/admin.ts`:
  - `GET /api/admin/activity-log`: paginated with `?start_date=`, `?end_date=`, `?event_type=` filters
- `packages/server/src/services/activityService.ts`: `getActivityLog(db, filters)` — query with optional date range and event type filters
- Verify all events from spec §11.8 are being logged by services built so far
- `packages/client/src/features/admin/activity/ActivityLogScreen.tsx`: table with date range picker + event type dropdown

**Validation**:
- [ ] Activity log shows all tracked event types that have occurred
- [ ] Date range filter works: only events within the range are shown
- [ ] Event type filter works: selecting "routine_approved" shows only those events
- [ ] Combined filters work: date range + event type together
- [ ] Pagination works for large activity logs
- [ ] Events include: routine submitted/approved/rejected, chore logged/approved/rejected, reward requested/approved/rejected/canceled, manual adjustment, badge unlocked
- [ ] Each event shows summary text, timestamp, and relevant entity info

---

### 3.8 Admin Settings Screen (Partial)

Build the settings screen with PIN change, timezone, time slots, and retention.

**Work**:
- `packages/server/src/routes/settings.ts`:
  - `GET /api/admin/settings`: return all settings
  - `PUT /api/admin/settings`: update settings (PIN change, timezone, time slots, retention)
- `packages/server/src/services/settingsService.ts`: `getSettings(db)`, `updateSettings(db, updates)`
- PIN change: hash new PIN, store in settings, invalidate all admin sessions
- `packages/client/src/features/admin/settings/SettingsScreen.tsx`: forms for each setting group

**Validation**:
- [ ] `GET /api/admin/settings` returns current settings (timezone, time slots, retention, etc.)
- [ ] `PUT /api/admin/settings` with new timezone updates the setting
- [ ] Changing admin PIN: new PIN is hashed and stored, old PIN no longer works
- [ ] Changing admin PIN: all existing sessions are invalidated (admin is forced to re-login)
- [ ] PIN must be at least 6 digits — shorter PIN returns `422`
- [ ] Changing time slot windows updates the values used by time slot logic
- [ ] Changing retention days updates the setting
- [ ] Settings screen UI shows current values and allows editing
- [ ] All settings endpoints require admin session

---

### 3.9 Unit + Integration Tests — Admin + Approvals

Write automated tests for admin CRUD, approval transactions, and badge evaluation.

**Work**:

**Server unit tests** (in-memory SQLite):

- `packages/server/tests/services/approvalService.test.ts`:
  - Test: `approveRoutineCompletion` changes status to `approved` and creates positive ledger entry
  - Test: `approveRoutineCompletion` ledger entry amount matches `points_snapshot`
  - Test: `rejectRoutineCompletion` changes status to `rejected`, NO ledger entry created
  - Test: `approveRoutineCompletion` on already-approved item throws `ConflictError` (double-tap safe)
  - Test: `approveChoreLog` creates positive ledger entry with correct amount
  - Test: `rejectChoreLog` with note stores the note on the record
  - Test: `approveRewardRequest` creates NEGATIVE ledger entry for `cost_snapshot`
  - Test: `approveRewardRequest` after approval, `reserved` decreases (pending → approved)
  - Test: `rejectRewardRequest` releases reservation (`reserved` decreases, `available` increases)
  - Test: approval transaction is atomic (if badge evaluation throws, ledger entry is also rolled back)
  - Test: rejecting a once_per_day routine makes the window available again

- `packages/server/tests/services/badgeService.test.ts`:
  - Test: `evaluate` returns empty array when no badges can be earned
  - Test: `first_step` earned after first approved routine completion
  - Test: `first_step` not re-earned on second approval (already earned)
  - Test: `on_a_roll` earned with 3 consecutive days of approved routines
  - Test: `on_a_roll` NOT earned with gap (days 1, 2, 4)
  - Test: `week_warrior` earned with 7 consecutive days
  - Test: `chore_champion` earned at exactly 10 approved chore logs
  - Test: `chore_champion` NOT earned at 9 approved logs
  - Test: `big_spender` earned on first approved reward
  - Test: `point_hoarder` earned when available points reach 100
  - Test: `point_hoarder` remains earned even if points drop below 100 later
  - Test: `helping_hand` earned with 5 help-tier chore logs
  - Test: `solo_act` earned with 5 alone-tier chore logs
  - Test: streak calculation uses household timezone for day boundaries
  - Test: badge is permanent — correcting an approval does not revoke badge

- `packages/server/tests/services/pointsService.test.ts` (additions):
  - Test: `createAdjustment` with positive amount increases total
  - Test: `createAdjustment` with negative amount decreases total
  - Test: `createAdjustment` without note throws `ValidationError`
  - Test: negative adjustment can make `available_points` negative
  - Test: when `available_points` is negative, new reward requests are blocked

**Server integration tests** (supertest):

- `packages/server/tests/routes/admin.test.ts`:
  - Test: all admin endpoints return `401` without session
  - Test: `POST /api/admin/routines` creates routine with checklist items
  - Test: `PUT /api/admin/routines/:id` updates routine
  - Test: `POST /api/admin/routines/:id/archive` archives routine
  - Test: same patterns for chores and rewards
  - Test: `GET /api/admin/approvals` returns grouped pending items
  - Test: `POST /api/admin/approvals/routine-completion/:id/approve` returns `200`
  - Test: `POST /api/admin/approvals/routine-completion/:id/approve` on already-approved returns `409`
  - Test: `POST /api/admin/points/adjust` creates adjustment
  - Test: `POST /api/admin/points/adjust` without note returns `422`
  - Test: `GET /api/admin/activity-log` returns events with filters
  - Test: `PUT /api/admin/settings` updates settings
  - Test: changing PIN invalidates all sessions

**Client component tests** (Vitest + React Testing Library + MSW):

- `packages/client/tests/features/admin/approvals/ApprovalCard.test.tsx`:
  - Test: renders snapshot data (name, points, time slot)
  - Test: approve button calls the correct API endpoint
  - Test: reject button opens note input, then calls API
  - Test: after approval, card is removed from the list
  - Test: double-clicking approve only sends one request

- `packages/client/tests/features/admin/routines/AdminRoutineForm.test.tsx`:
  - Test: renders form fields for routine
  - Test: inline checklist item editor supports add/remove/reorder
  - Test: submit calls create endpoint for new routine
  - Test: submit calls update endpoint for existing routine
  - Test: validation: name required, once_per_slot rejected for "Any Time"

**Validation**:
- [ ] `npm run test -- --run` passes with all tests green
- [ ] Approval tests verify transactional atomicity (both status + ledger or neither)
- [ ] Badge tests cover all 8 badges with positive and negative cases
- [ ] Double-tap safety tested for all approval types
- [ ] Streak calculation tests use timezone-aware day boundaries
- [ ] Admin auth tested across all admin endpoints
- [ ] Client approval card tests verify optimistic UI behavior
