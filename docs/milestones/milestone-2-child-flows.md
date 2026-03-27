# Milestone 2: Child Read + Write Flows

**Scope**: Large
**Depends on**: Milestone 1 (Foundation)
**Goal**: Build all child-facing screens and submission logic. At the end of this milestone the child can browse routines, complete checklists, log chores, request rewards, and see their points — all with idempotency and snapshot safety.

---

## Tasks

### 2.1 Child API — Read Endpoints

Build the server-side read endpoints the child views need.

**Work**:
- `packages/server/src/routes/child.ts`:
  - `GET /api/app/bootstrap`: returns today's routines (filtered by active time slot), pending item counts, points summary, recent badges
  - `GET /api/routines`: list active routines with checklist items, grouped by time slot
  - `GET /api/routines/:id`: single routine with checklist items
  - `GET /api/chores`: list active chores with active tiers
  - `GET /api/rewards`: list active rewards
  - `GET /api/points/summary`: returns `{ total, reserved, available }`
  - `GET /api/points/ledger`: paginated ledger entries (`limit`, `offset` query params)
  - `GET /api/badges`: list all earned badges
  - `GET /api/activity/recent`: recent activity events (limited to last 20)
- `packages/server/src/services/routineService.ts`: `getActiveRoutines(db)`, `getRoutineById(db, id)`
- `packages/server/src/services/choreService.ts`: `getActiveChores(db)`
- `packages/server/src/services/rewardService.ts`: `getActiveRewards(db)`
- `packages/server/src/services/pointsService.ts`: `getBalance(db)`, `getLedger(db, { limit, offset })`
- `packages/server/src/services/badgeService.ts`: `getEarnedBadges(db)`
- `packages/server/src/services/activityService.ts`: `getRecentActivity(db, limit)`
- `packages/server/src/lib/timeSlots.ts`: `getCurrentSlot(timezone, slotConfig)`, `isSlotActive(slot, timezone, slotConfig)`

**Validation**:
- [ ] `GET /api/routines` returns only active routines (archived excluded)
- [ ] Each routine includes its active checklist items in correct `sort_order`
- [ ] `GET /api/routines/:id` with nonexistent ID returns `404`
- [ ] `GET /api/chores` returns chores with their active tiers
- [ ] `GET /api/rewards` returns only active rewards
- [ ] `GET /api/points/summary` returns `{ total: 0, reserved: 0, available: 0 }` with empty ledger
- [ ] `GET /api/points/ledger` supports pagination: `?limit=10&offset=0` returns first page
- [ ] `GET /api/badges` returns empty array when no badges earned
- [ ] `GET /api/app/bootstrap` returns time-slot-filtered routines based on current time and configured timezone
- [ ] All responses follow the `{ "data": { ... } }` envelope
- [ ] No auth required — all child endpoints work without a session cookie

---

### 2.2 Time Slot Logic

Implement time slot window matching and completion window key generation.

**Work**:
- `packages/server/src/lib/timeSlots.ts`:
  - `getCurrentSlot(now, timezone, slotConfig)`: returns which slot(s) are active at the given time
  - `isRoutineVisible(routine, now, timezone, slotConfig)`: returns true if the routine's slot is currently active or if it's an "Any Time" routine
  - `getCompletionWindowKey(routine, localDate)`: generates the uniqueness key
    - `once_per_day`: `routine:{id}:day:{localDate}`
    - `once_per_slot`: `routine:{id}:slot:{localDate}:{timeSlot}`
    - `unlimited`: returns `null` (no uniqueness check)
- `packages/shared/src/constants.ts`: default slot windows

**Validation**:
- [ ] At 7:00 AM (household TZ), `getCurrentSlot` returns `Morning`
- [ ] At 4:00 PM, returns `Afternoon`
- [ ] At 8:00 PM, returns `Bedtime`
- [ ] At 12:00 PM (between Morning and Afternoon), returns no active slot (gap period)
- [ ] An "Any Time" routine is always visible regardless of current time
- [ ] `once_per_day` window key includes routine ID and local date only
- [ ] `once_per_slot` window key includes routine ID, local date, and time slot name
- [ ] `unlimited` returns null (no key)
- [ ] Time slot logic uses the household timezone setting, not server local time
- [ ] Custom slot windows (changed by admin) are respected

---

### 2.3 Routine Completion Submission

Build the routine completion flow with idempotency, window enforcement, and snapshots.

**Work**:
- `packages/server/src/routes/submissions.ts`: `POST /api/routine-completions`
  - Body: `{ routineId, checklistSnapshot, randomizedOrder, idempotencyKey, localDate }`
- `packages/server/src/services/routineService.ts`: `submitCompletion(db, data)`:
  1. Check idempotency key — if exists, return existing completion
  2. Load routine — if archived, throw `409`
  3. Calculate `completion_window_key`
  4. Check for existing `pending` or `approved` completion with same window key — if found, throw `409`
  5. Snapshot routine fields into the completion row
  6. If `requires_approval = false`: also create ledger entry + evaluate badges (same transaction)
  7. If `requires_approval = true`: set status to `pending`
  8. Insert activity event
  9. Return the new completion

**Validation**:
- [ ] Submitting a routine completion creates a `routine_completions` row with status `pending` (when requires_approval=true)
- [ ] Submitting a routine completion with `requires_approval=false` creates a `routine_completions` row with status `approved` AND a `points_ledger` entry
- [ ] Snapshot fields are captured: `routine_name_snapshot`, `time_slot_snapshot`, `points_snapshot`, `checklist_snapshot_json`
- [ ] Duplicate idempotency key returns the existing completion (not an error, not a duplicate row)
- [ ] `once_per_day` routine: second submission on the same local date returns `409` with `"already_completed"` code
- [ ] `once_per_day` routine: submission on a different local date succeeds
- [ ] `once_per_slot` routine: second submission in the same slot+date returns `409`
- [ ] `once_per_slot` routine: submission in a different slot on the same day succeeds
- [ ] `unlimited` routine: multiple submissions on the same day all succeed
- [ ] Submitting for an archived routine returns `409`
- [ ] If a `pending` completion is later rejected, the routine becomes available again (same window key can be reused)
- [ ] Activity event is created with type `routine_submitted`
- [ ] Points are NOT created when `requires_approval=true`
- [ ] Response follows `{ "data": { ... } }` envelope with the completion record

---

### 2.4 Chore Log Submission

Build chore logging with tier selection and idempotency.

**Work**:
- `packages/server/src/routes/submissions.ts`: `POST /api/chore-logs`
  - Body: `{ choreId, tierId, idempotencyKey, localDate }`
- `packages/server/src/services/choreService.ts`: `submitChoreLog(db, data)`:
  1. Check idempotency key
  2. Load chore + tier — validate both are active
  3. Snapshot chore name, tier name, points, requires_approval
  4. If `requires_approval = false`: create ledger entry + evaluate badges
  5. If `requires_approval = true`: set status to `pending`
  6. Insert activity event
- `POST /api/chore-logs/:id/cancel`: cancel a pending chore log (child-initiated)

**Validation**:
- [ ] Submitting a chore log creates a `chore_logs` row with correct snapshot fields
- [ ] `chore_name_snapshot` and `tier_name_snapshot` match the chore/tier at submission time
- [ ] Duplicate idempotency key returns existing log
- [ ] Chore with `requires_approval=false`: points ledger entry created immediately
- [ ] Chore with `requires_approval=true`: status is `pending`, no ledger entry
- [ ] Submitting with an archived chore returns `409`
- [ ] Submitting with an archived tier returns `409`
- [ ] Multiple chore logs for the same chore are allowed (chores can be logged repeatedly)
- [ ] `POST /api/chore-logs/:id/cancel` changes status from `pending` to `canceled`
- [ ] Canceling an already-approved chore log returns `409` (can't cancel after review)
- [ ] Canceling an already-canceled chore log returns `409`
- [ ] Activity events created for both submission and cancellation

---

### 2.5 Reward Request Submission with Point Reservation

Build reward requests with point reservation logic.

**Work**:
- `packages/server/src/routes/submissions.ts`: `POST /api/reward-requests`
  - Body: `{ rewardId, idempotencyKey, localDate }`
- `packages/server/src/services/rewardService.ts`: `submitRequest(db, data)`:
  1. Check idempotency key
  2. Load reward — validate active
  3. Calculate available points (total ledger - pending reservations)
  4. If `available < reward.points_cost`, throw `409` with `"insufficient_points"`
  5. Insert `reward_requests` row with `cost_snapshot = reward.points_cost`
  6. Insert activity event
  7. Return the request
- `POST /api/reward-requests/:id/cancel`: cancel pending request, releasing reservation

**Validation**:
- [ ] Submitting a reward request creates a `reward_requests` row with `status = 'pending'`
- [ ] `cost_snapshot` equals the reward's `points_cost` at submission time
- [ ] After submission, `GET /api/points/summary` shows `reserved` increased by the cost
- [ ] After submission, `available` points decreased by the cost
- [ ] Requesting a reward when `available < cost` returns `409` with `"insufficient_points"`
- [ ] Multiple pending requests are allowed if available points remain sufficient
- [ ] Duplicate idempotency key returns existing request
- [ ] `POST /api/reward-requests/:id/cancel` sets status to `canceled`
- [ ] After cancellation, `reserved` points decrease and `available` points increase
- [ ] Canceling an already-approved request returns `409`
- [ ] Requesting an archived reward returns `409`
- [ ] Negative `available_points` (from manual adjustment) blocks new requests
- [ ] All operations run in SQLite transactions (reservation + insert are atomic)

---

### 2.6 Today Screen

Build the child's landing screen.

**Work**:
- `packages/client/src/features/child/today/TodayScreen.tsx`:
  - Fetch bootstrap data via `useBootstrap` hook
  - Show time-aware routine cards (only routines for the current time slot + "Any Time")
  - Show pending items summary (counts of pending routines, chores, rewards)
  - Show mascot greeting (placeholder SVG for now)
  - Quick action button to log a chore
- `packages/client/src/features/child/today/RoutineCard.tsx`: card showing routine name, image, point value, completion status
- `packages/client/src/features/child/today/PendingItems.tsx`: grouped list of pending approvals
- `packages/client/src/features/child/today/QuickChoreLog.tsx`: button that opens chore selection

**Validation**:
- [ ] Today screen loads and displays routine cards
- [ ] Only routines matching the current time slot (or "Any Time") are shown
- [ ] During a gap period (e.g., 12pm), only "Any Time" routines appear
- [ ] Pending items section shows correct counts
- [ ] Already-completed routines (same window) show a "completed" state
- [ ] Mascot greeting placeholder is visible
- [ ] Quick chore log button opens the chore selection flow
- [ ] Screen refreshes data when returning from background (React Query refetch on focus)

---

### 2.7 Routines Screen and Checklist

Build the routine list and the full-screen checklist with IndexedDB drafts.

**Work**:
- `packages/client/src/features/child/routines/RoutinesScreen.tsx`: list all active routines grouped by time slot
- `packages/client/src/features/child/routines/RoutineChecklist.tsx`: full-screen checklist
- `packages/client/src/features/child/routines/ChecklistItem.tsx`: single item with checkbox, label, optional image
- `packages/client/src/lib/draft.ts`: IndexedDB draft manager using `idb`
  - `getDraft(routineId)`, `saveDraft(draft)`, `deleteDraft(routineId)`
  - Draft stores: `routineId`, `items` (with checked state), `startedAt`, `idempotencyKey`
- `packages/client/src/lib/idempotency.ts`: generate UUID via `crypto.randomUUID()`

**Validation**:
- [ ] Routines screen shows all active routines grouped by time slot
- [ ] Tapping a routine opens the full-screen checklist
- [ ] Checklist shows all active checklist items with labels and optional images
- [ ] Items with `randomizeItems=true` are shuffled once at session start
- [ ] Checking and unchecking items works (local state)
- [ ] Refreshing the page resumes the draft (items remain checked, same order)
- [ ] Closing and reopening the checklist on the same device resumes the draft
- [ ] Submit button sends completion to server with idempotency key
- [ ] After successful submission, draft is deleted from IndexedDB
- [ ] Re-opening the routine after completion starts a fresh session (for `unlimited` routines)
- [ ] For `once_per_day`/`once_per_slot` routines, already-completed routines show completion state
- [ ] Submit with no network shows offline error message

---

### 2.8 Rewards Screen

Build the rewards view with points display and request flow.

**Work**:
- `packages/client/src/features/child/rewards/RewardsScreen.tsx`: reward cards grid with points header
- `packages/client/src/features/child/rewards/RewardCard.tsx`: name, image, cost, progress bar, request button, pending status
- `packages/client/src/features/child/rewards/PointsDisplay.tsx`: total, reserved, available (available emphasized)

**Validation**:
- [ ] Rewards screen shows all active rewards as cards
- [ ] Each card displays name, image (if set), and point cost
- [ ] Progress bar shows `available / cost` progress
- [ ] Points display shows total, reserved, and available — available is visually prominent
- [ ] "Request" button is enabled when `available >= cost`
- [ ] "Request" button is disabled when `available < cost`
- [ ] Tapping "Request" submits a reward request and shows pending status
- [ ] Pending reward shows "Pending" badge and "Cancel" option
- [ ] Canceling a pending request updates the points display (reserved decreases)
- [ ] After requesting, the points display updates immediately (optimistic or after refetch)

---

### 2.9 Me Screen

Build the child's profile screen.

**Work**:
- `packages/client/src/features/child/me/MeScreen.tsx`: layout with points, badges, mascot, activity
- `packages/client/src/features/child/me/RecentActivity.tsx`: feed of recent events
- `packages/client/src/features/child/me/NotificationOptIn.tsx`: push notification toggle (placeholder — full implementation in Milestone 4)
- `packages/client/src/components/badges/BadgeCollection.tsx`: grid of badge icons
- `packages/client/src/components/badges/BadgeIcon.tsx`: single badge (earned vs locked state)

**Validation**:
- [ ] Me screen shows available points prominently
- [ ] Total and reserved points shown as secondary values
- [ ] Badge collection shows all 8 badge types
- [ ] Earned badges are visually distinct from locked/unearned badges
- [ ] Recent activity feed shows latest events
- [ ] Notification preferences placeholder is visible
- [ ] Mascot state placeholder is visible
- [ ] Points update after earning/spending points (navigating away and back refreshes data)

---

### 2.10 Unit + Integration Tests — Child Flows

Write automated tests for all child flow logic. These are the most critical tests in the app — they cover the core business rules.

**Work**:

**Client test infrastructure setup** (first time client tests need API mocking and component rendering):
- `packages/client/tests/setup.ts` — global test setup: configures jsdom environment, React Testing Library cleanup, starts MSW server in `beforeAll`, resets handlers in `afterEach`, stops server in `afterAll`
- `packages/client/tests/msw-handlers.ts` — default API mock handlers for MSW: mock responses for `/api/routines`, `/api/chores`, `/api/rewards`, `/api/points/summary`, `/api/badges`, `/api/activity/recent`, `/api/app/bootstrap`, `/api/auth/session`
- `packages/client/tests/test-utils.tsx` — custom `render` wrapper that wraps components with `QueryClientProvider` (fresh `QueryClient` per test), `MemoryRouter`, and `OnlineContext` provider. Exports `renderWithProviders` and re-exports `@testing-library/react` utilities.
- Install dev dependencies: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw`, `fake-indexeddb`

**Server unit tests** (in-memory SQLite):

- `packages/server/tests/lib/timeSlots.test.ts`:
  - Test: `getCurrentSlot` returns `Morning` at 7:00 AM
  - Test: `getCurrentSlot` returns `Afternoon` at 4:00 PM
  - Test: `getCurrentSlot` returns `Bedtime` at 8:00 PM
  - Test: `getCurrentSlot` returns null during gap period (12:00 PM)
  - Test: "Any Time" routine is always visible
  - Test: slot boundaries are inclusive (5:00 AM is Morning, 10:59 AM is Morning)
  - Test: custom slot windows from settings are used
  - Test: timezone parameter affects slot matching (e.g., UTC vs America/New_York)

- `packages/server/tests/services/routineService.test.ts`:
  - Test: `getActiveRoutines` returns only active routines with active checklist items
  - Test: `getActiveRoutines` excludes archived routines
  - Test: `submitCompletion` creates a completion with correct snapshot fields
  - Test: `submitCompletion` with `requires_approval=false` creates a ledger entry immediately
  - Test: `submitCompletion` with `requires_approval=true` does NOT create a ledger entry
  - Test: duplicate idempotency key returns existing completion (no error, no duplicate)
  - Test: `once_per_day` blocks second completion on same local_date
  - Test: `once_per_day` allows completion on a different local_date
  - Test: `once_per_slot` blocks second completion in same slot+date
  - Test: `once_per_slot` allows completion in different slot same day
  - Test: `unlimited` allows multiple completions same day
  - Test: completion for archived routine returns `ConflictError`
  - Test: snapshot fields match routine state at time of submission (not after edit)
  - Test: rejected completion frees the window for re-submission

- `packages/server/tests/services/choreService.test.ts`:
  - Test: `getActiveChores` returns chores with active tiers only
  - Test: `submitChoreLog` creates a log with correct snapshots
  - Test: `submitChoreLog` with `requires_approval=false` creates immediate ledger entry
  - Test: `submitChoreLog` with `requires_approval=true` sets status to `pending`
  - Test: duplicate idempotency key returns existing log
  - Test: log for archived chore returns `ConflictError`
  - Test: log for archived tier returns `ConflictError`
  - Test: `cancelChoreLog` changes status to `canceled`
  - Test: canceling an already-approved log returns `ConflictError`
  - Test: multiple chore logs for the same chore are allowed

- `packages/server/tests/services/rewardService.test.ts`:
  - Test: `submitRequest` creates a request with `cost_snapshot`
  - Test: `submitRequest` with sufficient points succeeds
  - Test: `submitRequest` with insufficient available points returns `ConflictError`
  - Test: after request, `reserved` increases by `cost_snapshot`
  - Test: after request, `available` decreases by `cost_snapshot`
  - Test: multiple pending requests allowed if available points remain sufficient
  - Test: `cancelRequest` sets status to `canceled` and releases reservation
  - Test: canceling approved request returns `ConflictError`
  - Test: duplicate idempotency key returns existing request
  - Test: request for archived reward returns `ConflictError`
  - Test: negative `available_points` blocks new requests

- `packages/server/tests/services/pointsService.test.ts`:
  - Test: `getBalance` with empty ledger returns `{ total: 0, reserved: 0, available: 0 }`
  - Test: `getBalance` after positive ledger entry shows correct total
  - Test: `getBalance` with pending reward request shows correct reserved and available
  - Test: `available = total - reserved` calculation is correct with mixed ledger entries
  - Test: `getLedger` returns entries in descending date order
  - Test: `getLedger` pagination with limit/offset works

**Server integration tests** (supertest):

- `packages/server/tests/routes/child.test.ts`:
  - Test: `GET /api/routines` returns routines without auth
  - Test: `GET /api/chores` returns chores without auth
  - Test: `GET /api/rewards` returns rewards without auth
  - Test: `GET /api/points/summary` returns balance
  - Test: `GET /api/badges` returns empty array initially
  - Test: `POST /api/routine-completions` creates completion
  - Test: `POST /api/chore-logs` creates chore log
  - Test: `POST /api/reward-requests` creates reward request
  - Test: `POST /api/chore-logs/:id/cancel` cancels pending log
  - Test: `POST /api/reward-requests/:id/cancel` cancels pending request
  - Test: all responses follow `{ "data": ... }` envelope

**Client unit tests** (Vitest):

- `packages/client/tests/lib/draft.test.ts`:
  - Test: `saveDraft` and `getDraft` round-trip correctly (use `fake-indexeddb`)
  - Test: `deleteDraft` removes the draft
  - Test: `getDraft` for nonexistent routine returns `undefined`
  - Test: draft preserves checked items and randomized order

- `packages/client/tests/lib/idempotency.test.ts`:
  - Test: generates a valid UUID string
  - Test: two calls produce different keys

**Client component tests** (Vitest + React Testing Library + MSW):

- `packages/client/tests/features/child/routines/RoutineChecklist.test.tsx`:
  - Test: renders checklist items from API data
  - Test: checking an item updates the item state
  - Test: submit button calls the API with correct payload
  - Test: after successful submit, navigates back to routines screen
  - Test: offline state disables submit button

- `packages/client/tests/features/child/rewards/PointsDisplay.test.tsx`:
  - Test: renders total, reserved, and available points
  - Test: "available" has emphasized styling (CSS class check)
  - Test: handles zero points correctly

- `packages/client/tests/features/child/rewards/RewardCard.test.tsx`:
  - Test: renders reward name, cost, and progress bar
  - Test: request button disabled when insufficient points
  - Test: request button enabled when sufficient points
  - Test: pending reward shows "Pending" badge and cancel option

**Validation**:
- [ ] `npm run test -- --run` passes with all tests green
- [ ] Server tests use in-memory SQLite — no file I/O between tests
- [ ] Client tests use `fake-indexeddb` for draft tests — no real IndexedDB
- [ ] Client component tests use MSW for API mocking — no real HTTP
- [ ] Time slot tests cover all boundary conditions
- [ ] Idempotency is tested for all three mutation types
- [ ] Point reservation math is tested with multiple concurrent pending requests
- [ ] Snapshot integrity is tested (edit after submit doesn't change snapshot)
