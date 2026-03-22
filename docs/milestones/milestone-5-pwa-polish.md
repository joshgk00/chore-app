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
  - `generateSW` mode with precache for all built assets (JS, CSS, HTML, SVG)
  - Runtime cache: `GET /api/*` with `NetworkFirst` strategy (3s timeout, fallback to cache)
  - Runtime cache: `/assets/*` with `CacheFirst` strategy (max 200 entries, 50MB limit)
- `public/manifest.json`:
  - `name: "Chores"`, `short_name: "Chores"`, `display: "standalone"`
  - `start_url: "/"`
  - Icons: `192x192` and `512x512` (PNG)
  - `background_color`, `theme_color`
- Create app icons at both sizes
- Register service worker in `main.tsx`

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
- [ ] App is installable as PWA from Chrome/Safari "Add to Home Screen"
- [ ] Installed PWA opens in standalone mode (no browser chrome)
- [ ] iOS Safari: app installs to home screen with correct icon and name

---

### 5.3 Offline Mode UX

Build the read-only offline experience.

**Work**:
- `packages/client/src/lib/offline.ts`:
  - `useOnlineStatus()` hook: tracks `navigator.onLine` + `online`/`offline` events
  - Export `OnlineContext` provider
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

**Work**:
- React error boundary component: catches render errors, shows friendly message with retry
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

**Work**:

**Test file locations** (following project convention — tests mirror `src/` structure under `tests/`):
- `packages/client/tests/components/mascot/Mascot.test.tsx`
- `packages/client/tests/components/mascot/mascotStates.test.ts` (actually `tests/components/mascot/` path mirrors `src/components/mascot/`)
- `packages/client/tests/lib/offline.test.ts`
- `packages/server/tests/jobs/retentionJob.test.ts`

**Server unit tests**:

- `packages/server/tests/jobs/retentionJob.test.ts`:
  - Test: job deletes activity events older than retention period
  - Test: job preserves events within the retention period
  - Test: job does NOT delete `points_ledger` entries (regardless of age)
  - Test: job does NOT delete `routine_completions`, `chore_logs`, `reward_requests`
  - Test: job does NOT delete `badges_earned`
  - Test: job handles empty `activity_events` table without error
  - Test: changing retention days setting affects which rows are deleted

**Client unit tests**:

- `packages/client/tests/components/mascot/mascotStates.test.ts`:
  - Test: morning time + no special context returns `greeting` state
  - Test: recent approval returns `happy` state
  - Test: badge just unlocked returns `celebrating` state
  - Test: pending approvals exist returns `waiting` state
  - Test: active draft in IndexedDB returns `encouraging` state
  - Test: bedtime slot returns `sleeping` state
  - Test: state priority: `celebrating` > `happy` > `encouraging` > `waiting` > `greeting` > `sleeping`

- `packages/client/tests/lib/offline.test.ts`:
  - Test: `useOnlineStatus` returns `true` when `navigator.onLine` is true
  - Test: `useOnlineStatus` returns `false` when offline event fires
  - Test: `useOnlineStatus` returns `true` when online event fires after offline

**Client component tests**:

- `packages/client/tests/components/mascot/Mascot.test.tsx`:
  - Test: renders SVG element
  - Test: different state prop produces different visual output (class or SVG path changes)

- Error boundary test:
  - Test: error boundary catches render error and shows fallback UI
  - Test: "Try Again" button re-renders the child component
  - Test: non-throwing component renders normally inside error boundary

- Offline banner test:
  - Test: banner not visible when online
  - Test: banner visible when offline
  - Test: mutation buttons are disabled when offline

**Full regression suite**:

At the end of Milestone 5, run the complete test suite to verify no regressions:
- All Milestone 1 tests (foundation, auth, DB)
- All Milestone 2 tests (child flows, submissions, points)
- All Milestone 3 tests (admin CRUD, approvals, badges)
- All Milestone 4 tests (assets, notifications, backup)
- All Milestone 5 tests (polish, offline, retention)

**Validation**:
- [ ] `npm run test -- --run` passes with ALL tests across all milestones
- [ ] Retention job tests confirm canonical tables are never touched
- [ ] Mascot state logic covers all 6 states and priority ordering
- [ ] Offline tests verify both detection and UI consequences
- [ ] Error boundary tests verify graceful failure handling
- [ ] Total test count provides meaningful coverage of all business rules
- [ ] No flaky tests — all tests are deterministic (no real timers, no real network)
