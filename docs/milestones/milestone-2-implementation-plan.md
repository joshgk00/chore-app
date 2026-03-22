# Milestone 2: Child Read + Write Flows

**Scope**: Large
**Depends on**: Milestone 1 (Foundation)
**Goal**: Build all child-facing screens and submission logic, delivered as five vertical slice PRs. Each PR ships a complete feature end-to-end — server service, routes, client hooks, UI components, and tests — so every merge leaves the app in a working, testable state.

---

## PR 1a: Infrastructure

Establishes the shared foundation all subsequent PRs build on: client test setup, MSW, online detection, IndexedDB drafts, idempotency utilities, and activity service. No UI screens, no feature-specific logic — just the plumbing subsequent PRs build on.

### Dependencies to install

```bash
# client
npm install --workspace packages/client idb
npm install --save-dev --workspace packages/client fake-indexeddb @testing-library/user-event
```

### Shared types (base)

`packages/shared/src/types.ts` — add:
- `FrequencyType`: `'once_per_day' | 'once_per_slot' | 'unlimited'`
- `TimeSlot`: `'Morning' | 'Afternoon' | 'Bedtime' | 'Any Time'`
- `BootstrapData` (initial shape — empty, extended by each subsequent PR)
- `SlotConfig` (base type — consumed by `timeSlots.ts` in PR 1b)
- `ActivityEvent` shape: `eventType`, `entityType`, `entityId`, `summary`, `metadata`, `createdAt`

`packages/shared/src/constants.ts` — default slot windows:
- `DEFAULT_MORNING_START`, `DEFAULT_MORNING_END`
- `DEFAULT_AFTERNOON_START`, `DEFAULT_AFTERNOON_END`
- `DEFAULT_BEDTIME_START`, `DEFAULT_BEDTIME_END`

### Server: activityService

`packages/server/src/services/activityService.ts`:
- `recordActivity(db, event)`: inserts an activity event row — called from `routineService`, `choreService`, and `rewardService` from PR 1b onward
- `getRecentActivity(db, limit)`: returns the most recent `limit` activity events (default 20)

The `ActivityEvent` type is defined in `packages/shared/src/types.ts` (see above) — all PRs import from shared.

PRs 1b–3 import and call `activityService.recordActivity` instead of inline inserts. PR 4 adds the routes and Me screen that expose this data — no service refactor needed.

### Server: rate limiting

Submission endpoints (`POST /api/routine-completions`, `POST /api/chore-logs`, `POST /api/reward-requests`) share a rate limiter: 10 requests per 10 seconds per IP. Frontend disables submit buttons during in-flight requests to prevent double-tap.

The `GET /api/app/bootstrap` endpoint is deferred to PR 1b (it requires time slot filtering, which is also in PR 1b).

Every route handler wrapped in try-catch with `next(err)`.

### Client: shared infrastructure

`packages/client/src/contexts/OnlineContext.tsx`:
- `OnlineProvider` wraps app; listens to `window.online`/`offline` events
- `useOnline()` hook returns current connectivity state
- **Offline sync on reconnect**: When the `online` event fires, query IndexedDB for any drafts with `submissionFailed: true` (add this flag to the draft schema in `draft.ts`). For each, re-POST using the stored idempotency key. On `200` or `409` (already exists): delete draft. On network error: leave in IndexedDB, retry on next `online` event with exponential backoff. Surface a toast to the child: `'Syncing your work...'`

`packages/client/src/lib/api.ts` (fetch client):
- All API calls use a 10-second timeout via `AbortController` + `setTimeout`. On timeout, the mutation is treated as a network error — drafts are preserved with their idempotency key for retry. TanStack Query's `retry: 2` with exponential backoff handles transient failures automatically.

`packages/client/src/lib/draft.ts` (IndexedDB via `idb`):
- `getDraft(routineId)`: returns draft or `undefined`
- `saveDraft(draft)`: persists `{ routineId, items, startedAt, idempotencyKey }`
- `deleteDraft(routineId)`: removes after successful submission

`packages/client/src/lib/idempotency.ts`:
- `generateKey()`: wraps `crypto.randomUUID()`

`packages/client/tests/setup.ts`:
- Global test setup: configures jsdom, React Testing Library cleanup, starts MSW server in `beforeAll`, resets handlers in `afterEach`, stops server in `afterAll`

`packages/client/tests/msw-handlers.ts`:
- Default MSW handlers for `/api/auth/session`
- Extended by PR 1b for `/api/app/bootstrap` and routine endpoints; later PRs add their own handlers

`packages/client/tests/test-utils.tsx`:
- `renderWithProviders(ui)`: wraps with `QueryClientProvider` (fresh `QueryClient` per test), `MemoryRouter`, `OnlineProvider`
- Re-exports all `@testing-library/react` utilities

### Tests

**Client unit — `packages/client/tests/lib/draft.test.ts`**:
- `saveDraft` + `getDraft` round-trips correctly (`fake-indexeddb`)
- `deleteDraft` removes the draft
- `getDraft` for nonexistent routine returns `undefined`
- Draft preserves checked items and randomized order

**Client unit — `packages/client/tests/lib/idempotency.test.ts`**:
- Generates a valid UUID string
- Two calls produce different keys

### Definition of done

- [ ] Rate limiter configured for all submission endpoints
- [ ] `OnlineContext` detects connectivity changes and triggers draft retry on reconnect
- [ ] `draft.ts` round-trips correctly with `fake-indexeddb`; draft preserves checked items and randomized order
- [ ] `idempotency.ts` generates unique UUID keys
- [ ] MSW test infrastructure set up (`setup.ts`, `test-utils.tsx`, `msw-handlers.ts`)
- [ ] `activityService.recordActivity` and `getRecentActivity` covered by unit tests
- [ ] `npm run test -- --run` passes green

---

## PR 1b: Routines (read + complete)

Builds on PR 1a. Adds the full routines feature end-to-end — service, routes, client hooks, UI screens, and tests.

### Server: time slot logic

`packages/server/src/lib/timeSlots.ts`:
- `getCurrentSlot(now, timezone, slotConfig)`: returns which slot(s) are active at the given time
- `isRoutineVisible(routine, now, timezone, slotConfig)`: true if the routine's slot is currently active or if it's "Any Time"
- `getCompletionWindowKey(routine, localDate)`: generates the uniqueness key
  - `once_per_day`: `routine:{id}:day:{localDate}`
  - `once_per_slot`: `routine:{id}:slot:{localDate}:{timeSlot}`
  - `unlimited`: returns `null` (no uniqueness check)

Slot config comes from `settingsService.getSlotConfig(db)` — reads customized windows from the settings table, falling back to `DEFAULT_*` constants.

### Shared types (routines)

`packages/shared/src/types.ts` — add:
- `Routine`, `ChecklistItem`, `RoutineCompletion`
- `RoutineCompletionStatus`: `'pending' | 'approved' | 'rejected'`

`BootstrapData` extended to include `{ routines, pendingRoutineCount }`.

### Server: routineService

`packages/server/src/services/routineService.ts`:
- `getActiveRoutines(db)`: returns active routines with active checklist items, sorted by `sort_order`
- `getRoutineById(db, id)`: returns single routine with items; throws `NotFoundError` if missing or archived
- `submitCompletion(db, data)`:
  - All steps (idempotency check, window key check, insert, ledger entry) run inside a single `db.transaction()` call. SQLite serializes writes, preventing race conditions.
  1. Check idempotency key — if exists, return existing completion
  2. Load routine — if archived, throw `ConflictError('archived')`
  3. Calculate `completion_window_key` via `getCompletionWindowKey`
  4. Check for existing `pending` or `approved` completion with same window key — if found, throw `ConflictError('already_completed')`
  5. Snapshot routine fields into the completion row (`routine_name_snapshot`, `time_slot_snapshot`, `points_snapshot`, `checklist_snapshot_json`)
  6. If `requires_approval = false`: create ledger entry in the same transaction; status = `approved`
  7. If `requires_approval = true`: status = `pending`
  8. Call `activityService.recordActivity(db, { type: 'routine_submitted', ... })`
  9. Return the new completion

### Server: routes

`packages/server/src/routes/child.ts` (new or extend):
- `GET /api/routines` — calls `routineService.getActiveRoutines`
- `GET /api/routines/:id` — calls `routineService.getRoutineById`
- `GET /api/app/bootstrap` — creates the bootstrap endpoint; returns `{ routines: slot-filtered list, pendingRoutineCount }` using time slot logic from `timeSlots.ts`

`packages/server/src/routes/submissions.ts` (new):
- `POST /api/routine-completions` — body: `{ routineId, checklistSnapshot, randomizedOrder, idempotencyKey, localDate }`

Every route handler wrapped in try-catch with `next(err)`.

### Client: hooks

- `packages/client/src/features/child/routines/hooks/useRoutines.ts`: `useQuery` → `GET /api/routines`
- `packages/client/src/features/child/routines/hooks/useRoutine.ts`: `useQuery` → `GET /api/routines/:id`
- `packages/client/src/features/child/routines/hooks/useSubmitRoutine.ts`: `useMutation` → `POST /api/routine-completions`; invalidates `routines` and `bootstrap` on success
- `packages/client/src/features/child/today/hooks/useBootstrap.ts`: `useQuery` → `GET /api/app/bootstrap`

`packages/client/tests/msw-handlers.ts` extended with `/api/routines`, `/api/routines/:id`, and updated bootstrap handler.

### Client: screens + components

`packages/client/src/features/child/today/TodayScreen.tsx`:
- Fetches bootstrap via `useBootstrap` with `staleTime: 60_000` (1 minute) and `refetchOnWindowFocus: true` (TanStack Query default). Each child screen (Routines, Rewards, Me) uses its own query hooks for fresh data — bootstrap is only for the Today overview. Add a manual pull-to-refresh gesture that calls `queryClient.invalidateQueries(['bootstrap'])`.
- Shows time-aware routine cards (slot-filtered)
- Shows pending routine count badge
- Mascot greeting placeholder SVG
- Loading skeleton, error state with retry, empty state

`packages/client/src/features/child/routines/RoutinesScreen.tsx`:
- All active routines grouped by time slot
- Loading skeleton, error with retry, empty state
- Offline indicator via `useOnline`

`packages/client/src/features/child/routines/RoutineChecklist.tsx`:
- Full-screen checklist
- Loads draft from IndexedDB on mount; saves on each check/uncheck. On mount, after loading the draft, re-fetch the routine via `useRoutine(id)`. If checklist items have changed (different count or IDs), discard the stale draft, show a brief toast ('Routine was updated — starting fresh'), and create a new draft. If items match, resume normally.
- Shuffles items once if `randomizeItems=true`, stored in draft so order survives refresh
- Shuffle button (if shown) is disabled once any checklist item has been checked — prevents mid-progress reordering that would corrupt the snapshot
- Submit button: disabled when offline, calls `useSubmitRoutine`, deletes draft on success
- If the server returns `409 archived`, delete the draft from IndexedDB and show a toast: 'This routine is no longer available.' Navigate back to `/routines`.
- Shows completion state for `once_per_day`/`once_per_slot` routines

`packages/client/src/features/child/routines/ChecklistItem.tsx`:
- Checkbox, label, optional image thumbnail
- Each item uses `role='checkbox'` with `aria-checked` reflecting state. State changes use color + checkmark icon (not color alone). Label includes item name. Tested with VoiceOver: item state is announced on focus.

### Tests

**Server unit — `packages/server/tests/lib/timeSlots.test.ts`**:
- `getCurrentSlot` returns `Morning` at 7:00 AM
- `getCurrentSlot` returns `Afternoon` at 4:00 PM
- `getCurrentSlot` returns `Bedtime` at 8:00 PM
- `getCurrentSlot` returns null during gap period (12:00 PM)
- "Any Time" routine is always visible regardless of time
- Slot boundaries are inclusive (5:00 AM is Morning, 10:59 AM is Morning)
- Custom slot windows from settings are used over defaults
- Timezone parameter affects slot matching (UTC vs America/New_York)
- Day boundary: 11:59 PM submission uses today's `localDate`, 12:00 AM uses tomorrow's
- DST spring-forward: slot boundaries still correct on transition day
- Device timezone differs from household timezone: server uses household TZ from settings, not request TZ

**Server unit — `packages/server/tests/services/routineService.test.ts`**:
- `getActiveRoutines` returns only active routines with active checklist items
- `getActiveRoutines` excludes archived routines
- `submitCompletion` creates completion with correct snapshot fields
- `submitCompletion` with `requires_approval=false` creates ledger entry immediately
- `submitCompletion` with `requires_approval=true` does NOT create ledger entry
- Duplicate idempotency key returns existing completion — no error, no duplicate row
- `once_per_day` blocks second completion on same `local_date`
- `once_per_day` allows completion on a different `local_date`
- `once_per_slot` blocks second completion in same slot+date
- `once_per_slot` allows completion in different slot same day
- `unlimited` allows multiple completions same day
- Completion for archived routine returns `ConflictError`
- Snapshot fields match routine state at submission time, not after subsequent edit
- Rejected completion frees the window key for re-submission

**Server integration — `packages/server/tests/routes/child.test.ts`** (partial, extended in later PRs):
- `GET /api/routines` returns routines without auth
- `GET /api/routines/:id` returns routine without auth
- `GET /api/routines/:id` with nonexistent ID returns 404
- `POST /api/routine-completions` creates completion
- `GET /api/app/bootstrap` returns slot-filtered routines and `pendingRoutineCount`
- All responses follow `{ "data": ... }` envelope

**Client component — `packages/client/tests/features/child/routines/RoutineChecklist.test.tsx`**:
- Renders checklist items from MSW-mocked API data
- Checking an item updates local state and persists to draft
- Submit button disabled when offline (`useOnline` returns false)
- Submit button calls API with correct payload (idempotency key, snapshot)
- After successful submit, draft is deleted and screen navigates back

### Definition of done

- [ ] `GET /api/routines` returns only active routines (archived excluded) with items in correct `sort_order`
- [ ] `GET /api/routines/:id` with nonexistent ID returns `404`
- [ ] Bootstrap returns time-slot-filtered routines using household timezone
- [ ] Snapshot fields correct: `routine_name_snapshot`, `time_slot_snapshot`, `points_snapshot`, `checklist_snapshot_json`
- [ ] Duplicate idempotency key returns existing completion — no error, no duplicate row
- [ ] `once_per_day` routine: second submission same local date → `409 already_completed`
- [ ] `once_per_day` routine: submission different local date → succeeds
- [ ] `once_per_slot` routine: second submission same slot+date → `409`
- [ ] `once_per_slot` routine: submission different slot same day → succeeds
- [ ] `unlimited` routine: multiple submissions same day → all succeed
- [ ] Archived routine submission → `409`
- [ ] Rejected completion frees the window key for re-submission
- [ ] Activity event created with type `routine_submitted`
- [ ] No points created when `requires_approval=true`
- [ ] Routines screen loads and groups by time slot; loading/error/empty states present
- [ ] Checklist draft persists across page refreshes; deleted after successful submit
- [ ] Submit button disabled when offline
- [ ] TodayScreen shows only slot-relevant routines
- [ ] `npm run test -- --run` passes green

---

## PR 2: Chores (log + cancel)

Builds on PR 1b. Adds the chore log flow end-to-end. TodayScreen gains a quick chore log entry point.

### 2a. Shared types

`packages/shared/src/types.ts` — add:
- `Chore`, `ChoreTier`, `ChoreLog`
- `ChoreLogStatus`: `'pending' | 'approved' | 'rejected' | 'canceled'`

### 2b. Server: choreService

`packages/server/src/services/choreService.ts`:
- `getActiveChores(db)`: returns active chores with their active tiers
- `submitChoreLog(db, data)`:
  - All steps (idempotency check, insert, ledger entry) run inside a single `db.transaction()` call. SQLite serializes writes, preventing race conditions.
  1. Check idempotency key
  2. Load chore + tier — validate both active; throw `ConflictError('archived')` otherwise
  3. Snapshot `chore_name_snapshot`, `tier_name_snapshot`, `points_snapshot`, `requires_approval`
  4. If `requires_approval = false`: create ledger entry in same transaction; status = `approved`
  5. If `requires_approval = true`: status = `pending`
  6. Call `activityService.recordActivity(db, { type: 'chore_submitted', ... })`
  7. Return the log
- `cancelChoreLog(db, logId)`:
  1. Load log — throw `NotFoundError` if missing
  2. If status is `canceled`, return the existing record (cancel is idempotent)
  3. If status is `approved` or `rejected`, throw `ConflictError('cannot_cancel')`
  4. Set status to `canceled`
  5. Call `activityService.recordActivity(db, { type: 'chore_canceled', ... })`

### 2c. Server: routes

`packages/server/src/routes/child.ts`:
- `GET /api/chores` — calls `choreService.getActiveChores`

`packages/server/src/routes/submissions.ts`:
- `POST /api/chore-logs` — body: `{ choreId, tierId, idempotencyKey, localDate }`
- `POST /api/chore-logs/:id/cancel`

`GET /api/app/bootstrap` evolves to also include `pendingChoreCount`.

### 2d. Client: hooks

- `packages/client/src/features/child/chores/hooks/useChores.ts`: `useQuery` → `GET /api/chores`
- `packages/client/src/features/child/chores/hooks/useSubmitChoreLog.ts`: `useMutation` → `POST /api/chore-logs`; invalidates `chores` and `bootstrap`
- `packages/client/src/features/child/chores/hooks/useCancelChoreLog.ts`: `useMutation` → `POST /api/chore-logs/:id/cancel`; invalidates `chores` and `bootstrap`

`packages/client/tests/msw-handlers.ts` extended with `/api/chores`, `/api/chore-logs`, `/api/chore-logs/:id/cancel`.

### 2e. Client: components

`packages/client/src/features/child/chores/QuickChoreLog.tsx`:
- Button on TodayScreen; opens chore selection sheet
- Lists active chores with tier options
- Submits via `useSubmitChoreLog`
- Loading, error, empty states; disabled when offline

`packages/client/src/features/child/today/TodayScreen.tsx` updated:
- Renders `QuickChoreLog`
- Shows `pendingChoreCount` from bootstrap

### 2f. Tests

**Server unit — `packages/server/tests/services/choreService.test.ts`**:
- `getActiveChores` returns chores with active tiers only
- `submitChoreLog` creates log with correct snapshots
- `submitChoreLog` with `requires_approval=false` creates immediate ledger entry
- `submitChoreLog` with `requires_approval=true` sets status to `pending`
- Duplicate idempotency key returns existing log — no duplicate row
- Log for archived chore → `ConflictError`
- Log for archived tier → `ConflictError`
- `cancelChoreLog` changes status to `canceled`
- Canceling already-approved or rejected log → `ConflictError`
- Canceling already-canceled log returns existing record — no error (idempotent)
- Multiple chore logs for same chore are allowed (no uniqueness constraint on chores)
- Activity events created for both submission and cancellation

**Server integration — extend `packages/server/tests/routes/child.test.ts`**:
- `GET /api/chores` returns chores without auth
- `POST /api/chore-logs` creates chore log
- `POST /api/chore-logs/:id/cancel` cancels pending log
- Bootstrap now includes `pendingChoreCount`

**Client component — `packages/client/tests/features/child/chores/QuickChoreLog.test.tsx`**:
- Renders chore list from MSW-mocked API
- Submitting a chore log calls the API with correct payload
- Canceling a pending log calls the cancel endpoint
- Submit disabled when offline

### 2g. Definition of done

- [ ] `GET /api/chores` returns chores with active tiers
- [ ] Snapshot fields correct: `chore_name_snapshot`, `tier_name_snapshot`, `points_snapshot`
- [ ] Duplicate idempotency key returns existing log — no duplicate row
- [ ] `requires_approval=false` → immediate ledger entry; `requires_approval=true` → `pending`, no entry
- [ ] Archived chore or archived tier → `409`
- [ ] Multiple logs for same chore on same day are allowed
- [ ] Cancel changes status to `canceled`; canceling approved or rejected → `409`; canceling already-canceled returns existing record (idempotent)
- [ ] Activity events created for submission and cancellation
- [ ] Bootstrap includes `pendingChoreCount`
- [ ] QuickChoreLog renders, submits, and shows offline state
- [ ] `npm run test -- --run` passes green

---

## PR 3: Rewards + Points (request + cancel)

Builds on PR 2. Adds the full rewards screen with point tracking and request/cancel flow.

### 3a. Shared types

`packages/shared/src/types.ts` — add:
- `Reward`, `RewardRequest`
- `RewardRequestStatus`: `'pending' | 'approved' | 'rejected' | 'canceled'`
- `PointsBalance`: `{ total: number; reserved: number; available: number }`
- `LedgerEntry`, `PointsSummary`

### 3b. Server: rewardService

`packages/server/src/services/rewardService.ts`:
- `getActiveRewards(db)`: returns active rewards
- `submitRequest(db, data)`:
  1. Check idempotency key
  2. Load reward — validate active; throw `ConflictError('archived')` otherwise
  3. Calculate available points: `SUM(points_ledger) − SUM(cost_snapshot WHERE status = 'pending')`
  4. If `available < reward.points_cost`, throw `ConflictError('insufficient_points')`
  5. Insert `reward_requests` row with `cost_snapshot = reward.points_cost`, status = `pending`
  6. Insert activity event (`reward_requested`)
  7. Return the request
  - All steps (idempotency check, points calculation, insert) run inside a single `db.transaction()` call. SQLite serializes writes, preventing race conditions.
- `cancelRequest(db, requestId)`:
  1. Load request — throw `NotFoundError` if missing
  2. If status is `canceled`, return the existing record (cancel is idempotent)
  3. If status is `approved` or `rejected`, throw `ConflictError('cannot_cancel')`
  4. Set status to `canceled` (reservation released — balance recalculates from ledger)
  5. Call `activityService.recordActivity(db, { type: 'reward_canceled', ... })`

### 3c. Server: pointsService

`packages/server/src/services/pointsService.ts`:
- `getBalance(db)`: aggregates `points_ledger` for `total`; sums `cost_snapshot` of pending `reward_requests` for `reserved`; returns `{ total, reserved, available }` where `available = total − reserved`
- `getLedger(db, { limit, offset })`: paginated ledger entries, descending by date

### 3d. Server: routes

`packages/server/src/routes/child.ts`:
- `GET /api/rewards` — calls `rewardService.getActiveRewards`
- `GET /api/points/summary` — calls `pointsService.getBalance`
- `GET /api/points/ledger` — calls `pointsService.getLedger` (`?limit=10&offset=0`)

`packages/server/src/routes/submissions.ts`:
- `POST /api/reward-requests` — body: `{ rewardId, idempotencyKey, localDate }`
- `POST /api/reward-requests/:id/cancel`

`GET /api/app/bootstrap` evolves to include `pointsSummary: { total, reserved, available }` and `pendingRewardCount`.

### 3e. Client: hooks

- `packages/client/src/features/child/rewards/hooks/useRewards.ts`: `useQuery` → `GET /api/rewards`
- `packages/client/src/features/child/rewards/hooks/useSubmitRewardRequest.ts`: `useMutation` → `POST /api/reward-requests`; invalidates `rewards`, `points`, `bootstrap`
- `packages/client/src/features/child/rewards/hooks/useCancelRewardRequest.ts`: `useMutation` → `POST /api/reward-requests/:id/cancel`; invalidates `rewards`, `points`, `bootstrap`
- `packages/client/src/features/child/rewards/hooks/usePoints.ts`: `useQuery` → `GET /api/points/summary`
- `packages/client/src/features/child/rewards/hooks/useLedger.ts`: `useQuery` → `GET /api/points/ledger`

`packages/client/tests/msw-handlers.ts` extended with `/api/rewards`, `/api/reward-requests`, `/api/reward-requests/:id/cancel`, `/api/points/summary`, `/api/points/ledger`.

### 3f. Client: screens + components

`packages/client/src/features/child/rewards/RewardsScreen.tsx`:
- Points header (`PointsDisplay`) + reward cards grid
- Loading skeleton, error with retry, empty state

`packages/client/src/features/child/rewards/RewardCard.tsx`:
- Name, image (if set), cost, progress bar (`available / cost`)
- "Request" button: enabled when `available >= cost`, disabled otherwise
- Pending state: "Pending" badge + "Cancel" button
- Refetches after request/cancel to update points display
- Tapping 'Request' opens a confirmation modal: 'Redeem [Reward Name] for [X] points?' with Cancel and Confirm buttons. The POST only fires after Confirm. This prevents accidental point spending.

`packages/client/src/features/child/rewards/PointsDisplay.tsx`:
- Shows `total`, `reserved`, `available` — `available` visually prominent

### 3g. Tests

**Server unit — `packages/server/tests/services/rewardService.test.ts`**:
- `submitRequest` creates request with correct `cost_snapshot`
- `submitRequest` with sufficient points succeeds
- `submitRequest` with insufficient available points → `ConflictError('insufficient_points')`
- After request, `reserved` increases by `cost_snapshot`
- After request, `available` decreases by `cost_snapshot`
- Multiple pending requests allowed if available points remain sufficient
- `cancelRequest` sets status to `canceled` and releases reservation
- Canceling already-canceled request returns existing record — no error (idempotent)
- Canceling approved or rejected request → `ConflictError`
- Duplicate idempotency key returns existing request — no duplicate row
- Request for archived reward → `ConflictError`
- Negative `available_points` (manual ledger adjustment) blocks new requests
- All operations atomic — rollback on failure leaves no partial state

**Server unit — `packages/server/tests/services/pointsService.test.ts`**:
- `getBalance` with empty ledger → `{ total: 0, reserved: 0, available: 0 }`
- `getBalance` after positive ledger entry shows correct total
- `getBalance` with pending reward request shows correct `reserved` and `available`
- `available = total − reserved` with mixed ledger entries
- `getLedger` returns entries in descending date order
- `getLedger` pagination with `limit`/`offset` works

**Server integration — extend `packages/server/tests/routes/child.test.ts`**:
- `GET /api/rewards` returns rewards without auth
- `GET /api/points/summary` returns balance
- `GET /api/points/ledger` supports pagination
- `POST /api/reward-requests` creates request
- `POST /api/reward-requests/:id/cancel` cancels pending request
- Bootstrap includes `pointsSummary` and `pendingRewardCount`

**Client component — `packages/client/tests/features/child/rewards/PointsDisplay.test.tsx`**:
- Renders total, reserved, and available points
- `available` has emphasized styling (CSS class check)
- Handles zero points correctly

**Client component — `packages/client/tests/features/child/rewards/RewardCard.test.tsx`**:
- Renders reward name, cost, and progress bar
- Request button disabled when insufficient points
- Request button enabled when sufficient points
- Pending reward shows "Pending" badge and cancel option
- Canceling pending request calls cancel endpoint

### 3h. Definition of done

- [ ] `submitRequest` creates request with correct `cost_snapshot`
- [ ] Insufficient available points → `409 insufficient_points`
- [ ] After request, `reserved` increases; `available` decreases
- [ ] Multiple pending requests allowed if points remain sufficient
- [ ] `cancelRequest` releases reservation
- [ ] Negative available points blocks new requests
- [ ] All reservation math is atomic (single SQLite transaction)
- [ ] `GET /api/points/ledger` pagination works (`limit`, `offset`)
- [ ] Bootstrap includes `pointsSummary` and `pendingRewardCount`
- [ ] RewardsScreen shows all active rewards with correct enable/disable state on Request button
- [ ] Pending reward shows cancel option; canceling updates points display
- [ ] `npm run test -- --run` passes green

---

## PR 4: Badges + Activity + Me

Builds on PRs 1b–3. Adds badge evaluation, activity tracking, and the Me screen. Badge evaluation must be wired into the submission services from earlier PRs — see cross-slice wiring instructions below.

### 4a. Shared types

`packages/shared/src/types.ts` — add:
- `Badge`, `BadgeType`, `BadgeDefinition`
- `ActivityEvent`, `ActivityEventType`

### 4b. Server: badgeService

`packages/server/src/services/badgeService.ts`:
- `getEarnedBadges(db)`: returns all badges the child has earned
- `evaluateBadges(db, context)`: called after any approved submission; checks all badge criteria and inserts newly earned badges
  - Badge types: `first_routine`, `streak_3`, `streak_7`, `perfect_week`, `chore_master`, `point_milestone_100`, `point_milestone_500`, `reward_redeemed`
  - Each badge is evaluated against current DB state; if criteria met and badge not yet earned, insert into `badges` table
  - Runs inside the same transaction as the parent submission so badge insertion is atomic with the ledger entry

### 4c. Server: activityService routes

`activityService` was created in PR 1a (server: activityService section). This PR adds the routes that expose it to the client:

- `GET /api/activity/recent` — calls `activityService.getRecentActivity` (see section 4e)

No service refactor needed — PRs 1b–3 already call `activityService.recordActivity` directly.

### 4d. Cross-slice wiring: badge evaluation

`evaluateBadges` must be called after every approved submission. Update the services from PRs 1b–2:

**`packages/server/src/services/routineService.ts` — in `submitCompletion`**, after creating the ledger entry on the `requires_approval=false` path:
```typescript
badgeService.evaluateBadges(db, { type: 'routine_completion', routineId, completionId })
```

**`packages/server/src/services/choreService.ts` — in `submitChoreLog`**, after creating the ledger entry on the `requires_approval=false` path:
```typescript
badgeService.evaluateBadges(db, { type: 'chore_log', choreId, logId })
```

Both calls run inside the same transaction as the ledger insertion. Approved admin reviews (Milestone 3) will also call `evaluateBadges` via the approval service — so badge evaluation is always paired with the ledger entry, never the pending insert.

### 4e. Server: routes

`packages/server/src/routes/child.ts`:
- `GET /api/badges` — calls `badgeService.getEarnedBadges`
- `GET /api/activity/recent` — calls `activityService.getRecentActivity` (default limit 20)

`GET /api/app/bootstrap` reaches its final shape: adds `recentBadges` (last 3 earned badges for mascot reaction). No premature fields — `completedWindowKeys` and `pendingRewardRequestsByRewardId` are not added; the UI reads those from individual query endpoints.

### 4f. Client: hooks

- `packages/client/src/features/child/me/hooks/useBadges.ts`: `useQuery` → `GET /api/badges`
- `packages/client/src/features/child/me/hooks/useActivity.ts`: `useQuery` → `GET /api/activity/recent`

`packages/client/tests/msw-handlers.ts` extended with `/api/badges`, `/api/activity/recent`; bootstrap handler updated to include `recentBadges`.

### 4g. Client: screens + components

`packages/client/src/features/child/me/MeScreen.tsx`:
- Layout: points header, badge collection, mascot placeholder, recent activity
- Loading skeleton, error with retry

`packages/client/src/components/badges/BadgeCollection.tsx`:
- Grid of all 8 badge types
- Earned vs locked visual distinction

`packages/client/src/components/badges/BadgeIcon.tsx`:
- Single badge icon — earned = full color, locked = grayscale

`packages/client/src/features/child/me/RecentActivity.tsx`:
- Feed of recent activity events; at most 20 items

`packages/client/src/features/child/me/NotificationOptIn.tsx`:
- Push notification toggle placeholder (full implementation in Milestone 4)

### 4h. Tests

**Server unit — `packages/server/tests/services/badgeService.test.ts`**:
- `getEarnedBadges` returns empty array when no badges earned
- `evaluateBadges` inserts `first_routine` badge on first routine completion
- `evaluateBadges` inserts `streak_3` after 3 consecutive days with a completion
- `evaluateBadges` does not re-insert badges already earned
- `evaluateBadges` runs atomically with parent transaction — rollback leaves no partial badge
- `point_milestone_100` earned when total crosses 100
- `point_milestone_500` earned when total crosses 500

**Server unit — `packages/server/tests/services/activityService.test.ts`**:
- `getRecentActivity` returns events in descending order
- `getRecentActivity` respects limit parameter
- `recordActivity` inserts correct event type and payload

**Server integration — extend `packages/server/tests/routes/child.test.ts`**:
- `GET /api/badges` returns empty array initially
- `GET /api/activity/recent` returns events in descending order
- Bootstrap includes `recentBadges`
- Badge awarded after completing a routine that grants immediate points

**Client component — `packages/client/tests/features/child/me/MeScreen.test.tsx`**:
- Renders points section, badge collection, and activity feed from MSW data
- Earned badges visually distinct from locked badges

**Client component — `packages/client/tests/components/badges/BadgeIcon.test.tsx`**:
- Renders earned badge with full-color styling
- Renders locked badge with grayscale styling

### 4i. Definition of done

- [ ] `getEarnedBadges` returns all earned badges; empty array when none
- [ ] `evaluateBadges` awards `first_routine` on first completion
- [ ] `evaluateBadges` awards `streak_3` / `streak_7` / `perfect_week` after correct consecutive days
- [ ] Badge insertion is atomic with the parent submission transaction
- [ ] Already-earned badges are not re-inserted
- [ ] `point_milestone_100` and `point_milestone_500` awarded when total crosses threshold
- [ ] `reward_redeemed` badge wired up when Milestone 3 approval service calls `evaluateBadges`
- [ ] `getRecentActivity` returns events in descending order, capped at limit
- [ ] Bootstrap in its final shape including `recentBadges`
- [ ] `evaluateBadges` wired into `routineService.submitCompletion` and `choreService.submitChoreLog`
- [ ] MeScreen shows points, badge grid, mascot placeholder, and activity feed
- [ ] Earned vs locked badges visually distinct
- [ ] `npm run test -- --run` passes green

---

## Architectural decisions

- **No premature bootstrap fields**: bootstrap grows one PR at a time. Fields like `completedWindowKeys` or `pendingRewardRequestsByRewardId` are not added until the UI component that reads them is built.
- **Idempotency on all mutations**: every `POST` accepts an `idempotencyKey`; service layer checks before inserting — returns existing record on duplicate, never an error or a duplicate row.
- **Snapshot integrity**: submission services snapshot entity state at submission time. Subsequent admin edits to the routine, chore, or reward do not retroactively change approval records.
- **Point reservation via SQL aggregation**: `reserved` is not stored as a column — it is calculated from pending `reward_requests`. This avoids double-write bugs and keeps the ledger as the single source of truth.
- **Badge evaluation is always atomic with the ledger entry**: `evaluateBadges` is called inside the same transaction as the `points_ledger` insert. It is never called on the `pending` insert path.
- **activityService created in PR 1a**: `activityService.recordActivity` is available from the start — PRs 1b–3 all call it directly. PR 4 adds the routes and Me screen only; no refactor of inline inserts is needed.
- **Offline support via OnlineContext**: `useOnline()` gates submit buttons across all screens. Checklist drafts survive page refresh via IndexedDB, and the idempotency key stored in the draft prevents duplicate submissions on retry. Drafts with `submissionFailed: true` are retried automatically when connectivity resumes.
- **Bootstrap mocks use partial matching**: each PR's tests mock only the fields introduced in that PR. The `BootstrapData` TypeScript interface uses optional fields for properties added in later PRs, so PR 1b tests remain valid after PR 3 adds `pointsSummary`.
- **10-second fetch timeout on all API calls**: implemented via `AbortSignal.timeout(10_000)` in the shared fetch client. On timeout, the mutation is treated as a network error — drafts are preserved with their idempotency key for retry. TanStack Query's `retry: 2` with exponential backoff handles transient failures automatically.
- **Insert ordering in transactions**: Within submission transactions, insert the completion/log/request record first, then the ledger entry, then badge evaluation, then activity event. If any later step fails, the entire transaction rolls back cleanly — no orphaned ledger entries.
