# Milestone 5: PWA Polish and Hardening

**Scope**: Small
**Depends on**: Milestone 4 (Assets, Notifications, Export/Restore)
**Goal**: Add the mascot, service worker, offline support, animations, responsive polish, and the retention job. At the end of this milestone the app is production-ready and installable as an iOS PWA.

---

## Tasks

### 5.1 Mascot SVG Component

Build the inline SVG mascot with state-driven expressions.

**Work**:
- `packages/client/src/components/mascot/Mascot.tsx`: inline SVG with props-driven state
- `packages/client/src/components/mascot/mascotStates.ts`: logic to determine mascot state based on context
- States (from spec §8.1):
  - `greeting`: default time-based greeting (morning/afternoon/evening)
  - `happy`: after approved routine/chore points earned
  - `celebrating`: badge unlocked or reward approved
  - `waiting`: pending approvals exist
  - `encouraging`: routine started but not finished (draft exists)
  - `sleeping`: bedtime slot or long inactivity

**Validation**:
- [ ] Mascot renders as inline SVG (no external image requests)
- [ ] Morning time: mascot shows morning greeting state
- [ ] Afternoon: appropriate greeting
- [ ] After points earned (approval): mascot shows `happy` state
- [ ] After badge unlock: mascot shows `celebrating` state
- [ ] When pending approvals exist: mascot shows `waiting` state
- [ ] When a routine draft exists in IndexedDB: mascot shows `encouraging` state
- [ ] During bedtime slot or after extended inactivity: mascot shows `sleeping` state
- [ ] State transitions are smooth (no jarring visual jumps)
- [ ] Mascot displays correctly on both Today and Me screens

---

### 5.2 Service Worker and PWA Manifest

Configure the service worker for app shell caching and offline support.

**Work**:
- Configure `vite-plugin-pwa` in `packages/client/vite.config.ts`:
  - `injectManifest` mode — the existing `sw.js` has push notification handlers that must be preserved. `generateSW` would overwrite them. `injectManifest` lets us keep the push handlers and add precaching on top.
  - Move `public/sw.js` to `src/sw.ts` as the source service worker. Import `precacheAndRoute` from `workbox-precaching` and add runtime caching via `workbox-routing` + `workbox-strategies`.
  - Precache: all built assets (JS, CSS, HTML, SVG) via the injected `self.__WB_MANIFEST`
  - Runtime cache: `GET /api/*` with `NetworkFirst` strategy (3s timeout, fallback to cache)
  - Runtime cache: `/assets/*` with `CacheFirst` strategy (max 200 entries, 50MB limit)
  - Preserve existing `push` and `notificationclick` event listeners from current `sw.js`
- `public/manifest.json`:
  - `name: "Chores"`, `short_name: "Chores"`, `display: "standalone"`
  - `start_url: "/"`
  - Icons: `192x192` and `512x512` (PNG)
  - `background_color`, `theme_color`
- Create app icons at both sizes
- Register service worker in `main.tsx` (replace the manual registration in `lib/push.ts` if present)

**Validation**:
- [ ] `manifest.json` is served at `/manifest.json` with correct content
- [ ] `manifest.json` has `display: "standalone"`, correct icons, correct start URL
- [ ] Service worker registers successfully on page load
- [ ] Built assets (JS, CSS) are precached by the service worker
- [ ] On second visit, app shell loads instantly from cache (even before network response)
- [ ] API responses are cached: after loading `/api/routines`, going offline still shows the data
- [ ] API cache uses NetworkFirst: fresh data is fetched when online, cache used when offline
- [ ] Asset images are cached with CacheFirst: images load from cache on repeat views
- [ ] Cache doesn't grow unbounded: max 200 entries for assets
- [ ] New deployment triggers service worker update (new precache manifest)
- [ ] Push notifications still work after SW migration (push + notificationclick handlers preserved)
- [ ] App is installable as PWA from Chrome/Safari "Add to Home Screen"
- [ ] Installed PWA opens in standalone mode (no browser chrome)
- [ ] iOS Safari: app installs to home screen with correct icon and name

---

### 5.3 Offline Mode UX

Build the read-only offline experience.

**Already exists**:
- `packages/client/src/contexts/OnlineContext.tsx`: `useOnline()` hook + `OnlineProvider` (tracks `navigator.onLine` + events)
- `OnlineProvider` already wraps `<App />` in `main.tsx`
- Tests already cover all three online/offline state transitions (`tests/contexts/OnlineContext.test.tsx`)

**Work**:
- Offline banner component: thin bar at top of screen when offline
- Disable all mutation buttons when offline (submit, approve, request, adjust, etc.)
- Show tooltip/message on disabled buttons explaining offline state
- Mutations attempted while offline show a clear error toast (not a spinner)
- Cached read data still renders in child views

**Validation**:
- [ ] Going offline shows a banner: "You're offline. Changes can't be saved right now."
- [ ] Going back online hides the banner
- [ ] All submit/approve/request buttons are disabled while offline
- [ ] Disabled buttons show a visual indicator (greyed out, tooltip)
- [ ] Tapping a disabled button shows an explanation (not nothing)
- [ ] Child can still browse Today, Routines, Rewards, Me screens with cached data
- [ ] If no cache exists for a screen, show empty state message (not a spinner)
- [ ] Admin PIN entry while offline shows offline message (can't verify PIN without server)
- [ ] Going back online and tapping submit works normally

---

### 5.4 Activity Retention Job

Build the scheduled cleanup job for old activity events.

**Work**:
- `packages/server/src/jobs/retentionJob.ts`:
  - Runs on a schedule (daily, via `setInterval` or `node-cron`)
  - Reads `activity_retention_days` from settings
  - Deletes `activity_events` rows older than the retention period
  - Does NOT touch `points_ledger`, `routine_completions`, `chore_logs`, `reward_requests`, `badges_earned`
  - Logs the number of rows purged

**Validation**:
- [ ] Job runs automatically on schedule
- [ ] Activity events older than `activity_retention_days` are deleted
- [ ] Activity events within the retention period are preserved
- [ ] `points_ledger` entries are NEVER deleted by the job (regardless of age)
- [ ] `routine_completions`, `chore_logs`, `reward_requests` are NEVER deleted
- [ ] `badges_earned` entries are NEVER deleted
- [ ] Changing `activity_retention_days` in settings affects the next job run
- [ ] Job logs how many rows were purged
- [ ] Job handles empty table gracefully (no errors when nothing to purge)

---

### 5.5 Animations and Transitions

Add polish animations for key interactions.

**Work**:
- Checklist item: check animation (checkmark draws in)
- Routine completion: celebration animation (confetti or sparkle)
- Badge unlock: badge reveal animation (scale + glow)
- Tab transitions: smooth content crossfade
- Card interactions: subtle press/hover feedback
- Points counter: number roll animation on change
- Approval action: card slide-out on approve/reject

**Validation**:
- [ ] Checking a checklist item shows a checkmark animation
- [ ] Completing a routine shows a brief celebration animation
- [ ] Badge unlock shows a reveal animation with visual emphasis
- [ ] Tab switching has smooth transitions (no hard content swap)
- [ ] Cards respond to tap with subtle feedback
- [ ] Points changing (after approval) shows a number animation
- [ ] Animations respect `prefers-reduced-motion` — disabled when user prefers reduced motion
- [ ] Animations don't cause layout shifts or jank
- [ ] Animation durations are short (200-400ms) and don't block interaction

---

### 5.6 Responsive Layout and Touch Target Audit

Final pass on tablet-first responsive design and accessibility.

**Work**:
- Audit all interactive elements for 44x44 minimum touch target
- Tablet-first breakpoints:
  - Base styles: 768px+ (iPad)
  - `@media (max-width: 599px)`: phone adaptations (stack layouts, full-width cards)
  - `@media (min-width: 1024px)`: desktop (max-width content area)
- Test on iPad Safari, iPhone Safari, Chrome
- Ensure bottom tab bar doesn't overlap with iOS safe areas
- Admin forms: ensure inputs and buttons are usable on tablet

**Validation**:
- [ ] All buttons, links, checkboxes, and toggles are at least 44x44 CSS pixels
- [ ] On iPad (768px): layout looks natural, no wasted space, no overflow
- [ ] On iPhone (375px): layout adapts — cards stack vertically, tab bar fits
- [ ] On desktop (1200px): content has max-width constraint, centered
- [ ] Bottom tab bar clears iOS home indicator (safe area padding)
- [ ] No horizontal scrolling on any screen at any breakpoint
- [ ] Text is readable without zooming on all devices
- [ ] Admin forms are usable on tablet — inputs are large enough to tap
- [ ] Modal/overlay components are scrollable if content exceeds viewport

---

### 5.7 Error Boundaries and Loading States

Add resilience patterns for a polished UX.

**Already exists**:
- `packages/client/src/components/ErrorBoundary.tsx`: class component that catches render errors, shows fallback with reload button
- App root and child page are already wrapped with `<ErrorBoundary>`

**Needs improvement**:
- Current "Try Again" reloads the entire page (`window.location.reload()`). Should reset error state and re-render the child tree instead.
- Uses raw Tailwind colors (`text-gray-900`, `bg-indigo-600`) instead of design system tokens. Must switch to `var(--color-*)` tokens and `font-display`.
- Add `aria-live="assertive"` to error fallback for screen reader announcement.

**Work**:
- Enhance existing error boundary: in-place retry (state reset), design tokens, accessibility
- Loading skeletons for:
  - Routine cards (Today screen)
  - Reward cards
  - Points display
  - Approval queue items
  - Activity log entries
- Empty state components for:
  - No routines configured
  - No chores available
  - No rewards available
  - No pending approvals
  - No activity yet

**Validation**:
- [ ] A component throwing an error shows the error boundary (not a white screen)
- [ ] Error boundary offers a "Try Again" button that re-renders
- [ ] While data is loading, skeleton placeholders are visible (not spinners)
- [ ] Skeletons match the layout of the actual content (no layout shift when data loads)
- [ ] Empty states show helpful messages (e.g., "No routines yet. Ask your parent to set some up!")
- [ ] Admin empty states are action-oriented (e.g., "No rewards yet." with "Create Reward" button)
- [ ] Network errors show a retry-friendly error state (not a crash)
- [ ] Rapid navigation between tabs doesn't cause race conditions or stale data display

---

### 5.8 Unit + Component Tests — Polish

Write tests for mascot state logic, offline behavior, retention, and error boundaries.

**Already exists**:
- `packages/client/tests/contexts/OnlineContext.test.tsx`: 3 tests covering all online/offline state transitions. No additional online/offline hook tests needed.

**Work**:

Tests ship with their corresponding PR — this task lists all new tests for reference.

**Test file locations** (following project convention — tests mirror `src/` structure under `tests/`):
- `packages/client/tests/components/mascot/Mascot.test.tsx` (PR 1)
- `packages/client/tests/components/mascot/mascotStates.test.ts` (PR 1)
- `packages/server/tests/jobs/retentionJob.test.ts` (PR 3)
- `packages/client/tests/components/OfflineBanner.test.tsx` (PR 3)
- `packages/client/tests/components/ErrorBoundary.test.tsx` (PR 5)

**Server unit tests** (PR 3):

- `packages/server/tests/jobs/retentionJob.test.ts`:
  - Test: job deletes activity events older than retention period
  - Test: job preserves events within the retention period
  - Test: job does NOT delete `points_ledger` entries (regardless of age)
  - Test: job does NOT delete `routine_completions`, `chore_logs`, `reward_requests`
  - Test: job does NOT delete `badges_earned`
  - Test: job handles empty `activity_events` table without error
  - Test: changing retention days setting affects which rows are deleted

**Client unit tests** (PR 1):

- `packages/client/tests/components/mascot/mascotStates.test.ts`:
  - Test: morning time + no special context returns `greeting` state
  - Test: recent approval returns `happy` state
  - Test: badge just unlocked returns `celebrating` state
  - Test: pending approvals exist returns `waiting` state
  - Test: active draft in IndexedDB returns `encouraging` state
  - Test: bedtime slot returns `sleeping` state
  - Test: state priority: `celebrating` > `happy` > `encouraging` > `waiting` > `greeting` > `sleeping`

**Client component tests** (PRs 1, 3, 5):

- `packages/client/tests/components/mascot/Mascot.test.tsx` (PR 1):
  - Test: renders SVG element
  - Test: different state prop produces different visual output (class or SVG path changes)

- `packages/client/tests/components/OfflineBanner.test.tsx` (PR 3):
  - Test: banner not visible when online
  - Test: banner visible when offline
  - Test: mutation buttons are disabled when offline

- `packages/client/tests/components/ErrorBoundary.test.tsx` (PR 5):
  - Test: error boundary catches render error and shows fallback UI
  - Test: "Try Again" button re-renders the child (state reset, not page reload)
  - Test: non-throwing component renders normally inside error boundary

**E2E tests** (PR 5 — final PR):

- `e2e/offline.spec.ts`:
  - Test: offline banner appears when network is disabled
  - Test: submit buttons are disabled while offline
  - Test: banner disappears and submit works after going back online

**Full regression suite**:

At the end of Milestone 5, run the complete test suite to verify no regressions:
- All Milestone 1 tests (foundation, auth, DB)
- All Milestone 2 tests (child flows, submissions, points)
- All Milestone 3 tests (admin CRUD, approvals, badges)
- All Milestone 4 tests (assets, notifications, backup)
- All Milestone 5 tests (polish, offline, retention)

**Validation**:
- [ ] `npm run test -- --run` passes with ALL tests across all milestones
- [ ] `npm run test:e2e` passes including new offline E2E tests
- [ ] Retention job tests confirm canonical tables are never touched
- [ ] Mascot state logic covers all 6 states and priority ordering
- [ ] Offline tests verify both detection and UI consequences
- [ ] Error boundary tests verify graceful failure handling
- [ ] Total test count provides meaningful coverage of all business rules
- [ ] No flaky tests — all tests are deterministic (no real timers, no real network)

---

## PR Plan

5 PRs. PRs 1–4 are independent and can be built in parallel. PR 5 goes last.

```
PR 1 (Mascot) ──────────────┐
PR 2 (SW + PWA) ────────────┤
PR 3 (Offline + Retention) ──┼──→ PR 5 (Polish + Loading States + E2E)
PR 4 (Animations) ───────────┘
```

### PR 1: Mascot SVG Component (Task 5.1)

**Scope**: Client-only. New feature, self-contained.
**Tasks**: 5.1, mascot tests from 5.8
**Est. size**: ~250 impl + ~200 test lines

**Files**:
- New: `packages/client/src/components/mascot/Mascot.tsx`
- New: `packages/client/src/components/mascot/mascotStates.ts`
- New: `packages/client/tests/components/mascot/Mascot.test.tsx`
- New: `packages/client/tests/components/mascot/mascotStates.test.ts`
- Modified: Today screen and Me screen (add `<Mascot />`)

---

### PR 2: Service Worker + PWA Manifest (Task 5.2)

**Scope**: Client infrastructure. Config-heavy, less raw code.
**Tasks**: 5.2
**Est. size**: ~300 impl + ~50 config lines

**Files**:
- New: `packages/client/src/sw.ts` (migrated from `public/sw.js` + workbox precaching/routing)
- New: `packages/client/public/manifest.json`
- New: App icons (192x192, 512x512 PNG)
- Modified: `packages/client/vite.config.ts` (add vite-plugin-pwa with injectManifest)
- Modified: `packages/client/src/main.tsx` (SW registration)
- Deleted: `packages/client/public/sw.js` (moved to `src/sw.ts`)

**Risk**: Highest integration risk in M5. The `injectManifest` approach must preserve push notification handlers while adding workbox precaching. Test push notifications manually after this PR.

---

### PR 3: Offline UX + Activity Retention Job (Tasks 5.3 + 5.4)

**Scope**: Mixed client + server. Both are resilience features with clean boundaries.
**Tasks**: 5.3, 5.4, offline banner tests and retention tests from 5.8
**Est. size**: ~300 impl + ~250 test lines
**Why combined**: 5.3 is ~200 impl lines (OnlineContext already exists, just need banner + button disabling). 5.4 is ~150 impl lines (single job file + init). Both under 200 lines solo.

**Files**:
- New: `packages/client/src/components/OfflineBanner.tsx`
- New: `packages/server/src/jobs/retentionJob.ts`
- New: `packages/client/tests/components/OfflineBanner.test.tsx`
- New: `packages/server/tests/jobs/retentionJob.test.ts`
- Modified: Mutation components (add `useOnline()` disabled state to submit/approve/request buttons)
- Modified: `packages/server/src/index.ts` (init retention job on startup)
- Modified: `packages/client/src/App.tsx` or layout (mount `<OfflineBanner />`)

---

### PR 4: Animations and Transitions (Task 5.5)

**Scope**: Client-only. Many small changes across existing components.
**Tasks**: 5.5
**Est. size**: ~400–500 impl lines across ~15 files

**Files**:
- New: `packages/client/src/styles/animations.css` (keyframes, reduced-motion media query)
- Modified: Checklist items, routine completion flow, badge components, tab navigation, card components, points display, approval cards

**Commit guidance**: Structure commits by animation type (checklist, celebrations, tab transitions, card feedback, points counter, approval slide-out) so review is manageable despite the wide file spread.

---

### PR 5: Error Boundaries, Loading States, Responsive Polish + E2E (Tasks 5.6 + 5.7 + E2E from 5.8)

**Scope**: Client-only. Final polish pass over existing UI.
**Tasks**: 5.6, 5.7, error boundary tests and E2E tests from 5.8
**Est. size**: ~500–600 impl + ~150 test lines
**Why combined**: Both are audit-and-improve passes over existing UI. Skeleton/empty-state components will be affected by responsive adjustments — doing them together avoids touching the same files twice.
**Split guidance**: If this exceeds ~800 impl lines, split responsive audit (5.6) from error boundaries + loading states (5.7).

**Files**:
- Modified: `packages/client/src/components/ErrorBoundary.tsx` (retry via state reset, design tokens, a11y)
- New: Skeleton components (routine card, reward card, points, approval items, activity entries)
- New: Empty state components (no routines, no chores, no rewards, no approvals, no activity)
- New: `packages/client/tests/components/ErrorBoundary.test.tsx`
- New: `e2e/offline.spec.ts`
- Modified: All screen components (integrate skeletons + empty states)
- Modified: `packages/client/src/styles/globals.css` (touch targets, breakpoints, safe areas)
