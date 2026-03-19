# Milestone 1: Foundation

**Scope**: Medium
**Goal**: Scaffold the monorepo, database, auth system, Docker setup, and CI pipeline. At the end of this milestone the app boots in a container, serves a React shell, and supports admin PIN login with session management.

### Test Conventions (established in this milestone, followed by all subsequent milestones)

- **Location**: Tests live in dedicated `tests/` directories within each package, mirroring the `src/` structure. Production source (`src/`) contains no test files.
- **Build exclusion**: `packages/server/tsconfig.json` excludes `tests/` from compilation. `packages/client/vite.config.ts` only processes `src/` for production builds.
- **Tooling**: `vitest` (test runner for both packages), `supertest` (HTTP integration tests for Express routes), `@testing-library/react` (component tests), `msw` (API mocking in client tests), `fake-indexeddb` (IndexedDB mock for draft tests), `sharp` test fixtures (real images for asset tests in Milestone 4).
- **Running tests**: `npm run test` runs all tests across all workspaces via vitest workspace config. `npm run test --workspace=packages/server` and `npm run test --workspace=packages/client` run package-specific tests. `npm run test -- --run` for CI mode (no watch).
- **Server test isolation**: Each test suite gets a fresh in-memory (`:memory:`) SQLite database via `createTestDb()` helper — no file I/O, no shared state between suites.

---

## Tasks

### 1.1 Monorepo Scaffold

Set up the npm workspaces monorepo with three packages.

**Work**:
- Create root `package.json` with `workspaces: ["packages/shared", "packages/server", "packages/client"]`
- Create `packages/shared/package.json` with TypeScript config
- Create `packages/server/package.json` with TypeScript config
- Create `packages/client/package.json` with Vite + React + TypeScript
- Configure root-level `tsconfig.json` with project references
- Add `eslint` + `prettier` configs at root
- Add root scripts: `dev`, `build`, `lint`, `typecheck`, `test`
- Install `concurrently` for running client + server in parallel during dev

**Validation**:
- [ ] `npm install` succeeds from root with no errors
- [ ] `npm run typecheck` passes (no TypeScript errors)
- [ ] `npm run lint` passes with no warnings
- [ ] Each workspace is recognized: `npm ls --workspaces` shows all three packages
- [ ] `packages/shared/src/types.ts` exports at least one type that `packages/server` can import without error

---

### 1.2 Shared Package — Types and Constants

Create shared TypeScript types and constants used by both client and server.

**Work**:
- `packages/shared/src/types.ts`: API response envelope (`ApiSuccess<T>`, `ApiError`), status enums (`pending`, `approved`, `rejected`, `canceled`), entry types (`routine`, `chore`, `reward`, `manual`), time slot enum, completion rule enum
- `packages/shared/src/constants.ts`: default time slot windows, badge key constants, PIN length minimum

**Validation**:
- [ ] `npm run build --workspace=packages/shared` compiles with no errors
- [ ] Server package can `import { Status, TimeSlot } from '@chore-app/shared'` and compile
- [ ] Client package can import the same types and compile
- [ ] All enums match the values defined in spec sections 7.3, 7.4, 8.2, and 14.1

---

### 1.3 Express Server Skeleton

Create the Express app with config validation, health check, and static file serving.

**Work**:
- `packages/server/src/config.ts`: load and validate env vars. `PUBLIC_ORIGIN` is required — throw on startup if missing. Defaults: `PORT=3000`, `DATA_DIR=./data` (dev), `TZ=America/New_York`
- `packages/server/src/app.ts`: Express app factory. Register `express.json()`, `cookie-parser`, static file serving for client dist, SPA fallback for non-API routes, 404 handler for `/api/*`
- `packages/server/src/index.ts`: bootstrap sequence — config → db → migrations → seed → VAPID → listen
- `GET /api/health` returns `{ "data": { "status": "ok" } }`
- Set `app.set('trust proxy', 1)` for Cloudflare Tunnel
- `packages/server/src/lib/errors.ts`: `AppError` class hierarchy (`ValidationError`, `ConflictError`, `AuthError`, `NotFoundError`)
- `packages/server/src/middleware/errorHandler.ts`: catch-all error middleware returning spec-compliant `{ error: { code, message, fieldErrors } }`

**Validation**:
- [ ] Server starts with `npm run dev --workspace=packages/server` on default config
- [ ] `GET http://localhost:3000/api/health` returns `200` with `{ "data": { "status": "ok" } }`
- [ ] Server exits with clear error message when `PUBLIC_ORIGIN` is not set
- [ ] `GET /api/nonexistent` returns `404` with `{ "error": { "code": "NOT_FOUND", "message": "..." } }`
- [ ] Thrown `AppError` in a route returns correct status code and structured error body
- [ ] Unhandled error returns `500` with generic message (no stack trace in response)

---

### 1.4 Database Connection and Migration Runner

Set up SQLite via better-sqlite3 with WAL mode and a migration system.

**Work**:
- `packages/server/src/db/connection.ts`: open better-sqlite3 instance, set `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000`
- `packages/server/src/db/migrate.ts`: read numbered `.sql` files from `migrations/` dir, track applied versions in a `_migrations` table, run unapplied migrations in transactions
- `packages/server/src/db/migrations/001-initial-schema.sql`: all 14 tables from spec §14 with:
  - `CHECK` constraints on status fields (`pending`, `approved`, `rejected`, `canceled`)
  - `UNIQUE` on `idempotency_key` columns
  - `UNIQUE` on `badge_key` in `badges_earned`
  - `UNIQUE` on `endpoint` in `push_subscriptions`
  - Non-negative `CHECK` on `points_cost` in rewards
  - Foreign key references between tables
  - Indexes on: approval status fields, created timestamps, reward request status+date, points ledger date

**Validation**:
- [ ] On first startup, `data/db.sqlite` is created
- [ ] All 14 tables exist: `routines`, `checklist_items`, `chores`, `chore_tiers`, `rewards`, `assets`, `routine_completions`, `chore_logs`, `reward_requests`, `points_ledger`, `badges_earned`, `push_subscriptions`, `admin_sessions`, `settings`, `activity_events`
- [ ] `_migrations` table tracks migration `001` as applied
- [ ] Running startup again does NOT re-apply migration 001 (idempotent)
- [ ] Foreign keys are enforced: inserting a `checklist_items` row with nonexistent `routine_id` fails
- [ ] Status CHECK constraint works: inserting `routine_completions` with `status = 'invalid'` fails
- [ ] WAL mode is active: `PRAGMA journal_mode` returns `wal`
- [ ] Adding a `002-*.sql` file and restarting applies only the new migration

---

### 1.5 First-Boot Seed Logic

Bootstrap default settings and VAPID keys on first run.

**Work**:
- `packages/server/src/services/settingsService.ts`: on startup, check if `settings` table is empty. If so, insert defaults:
  - `admin_pin_hash`: scrypt hash of `INITIAL_ADMIN_PIN` env var
  - `timezone`: from `TZ` env var
  - `activity_retention_days`: from `ACTIVITY_RETENTION_DAYS_DEFAULT` env var
  - Time slot windows: `morning_start=05:00`, `morning_end=10:59`, `afternoon_start=15:00`, `afternoon_end=18:29`, `bedtime_start=18:30`, `bedtime_end=21:30`
- `packages/server/src/lib/crypto.ts`: `hashPin(pin)` → `salt:hash` using `crypto.scryptSync`, `verifyPin(pin, stored)` → boolean
- `packages/server/src/services/pushService.ts` (init portion): check if `/data/secrets/webpush.json` exists. If not, generate VAPID keys via `web-push.generateVAPIDKeys()`, write to file. Load keys on startup.

**Validation**:
- [ ] First boot with `INITIAL_ADMIN_PIN=123456` creates `admin_pin_hash` in settings table
- [ ] `admin_pin_hash` value is NOT the raw PIN (it's a salt:hash string)
- [ ] Second boot does NOT overwrite existing settings
- [ ] Changing `INITIAL_ADMIN_PIN` env var on second boot has no effect (PIN already set)
- [ ] `/data/secrets/webpush.json` is created on first boot with `publicKey` and `privateKey` fields
- [ ] Second boot uses existing VAPID keys (file unchanged)
- [ ] Default time slot values in settings match spec §7.3 windows
- [ ] Default timezone matches `TZ` env var value

---

### 1.6 Admin Auth — PIN Verification and Sessions

Implement PIN login, session management, and auto-expiry.

**Work**:
- `packages/server/src/services/authService.ts`:
  - `verifyPin(pin)`: load hash from settings, verify with `crypto.ts`, return session token or throw
  - `createSession()`: generate 32-byte random token, store SHA-256 hash in `admin_sessions` with `expires_at = now + 10min`
  - `validateSession(token)`: hash token, look up in `admin_sessions`, check expiry, update `last_seen_at` + extend `expires_at`
  - `destroySession(tokenHash)`: delete row
  - `destroyAllSessions()`: delete all rows (for PIN change, restore)
- `packages/server/src/routes/auth.ts`:
  - `POST /api/auth/verify`: body `{ pin }`, verify PIN, create session, set HTTP-only cookie `chores_session`
  - `GET /api/auth/session`: check if current cookie is valid, return `{ "data": { "valid": true } }` or `401`
  - `POST /api/auth/lock`: clear the session cookie (session expires naturally)
  - `POST /api/auth/logout`: destroy session row + clear cookie
- `packages/server/src/middleware/adminAuth.ts`: validate session cookie on every `/api/admin/*` request, refresh expiry on success, return `401` on failure
- Cookie settings: `HttpOnly`, `Secure` (when not localhost), `SameSite=Strict`, `Path=/api`, `Max-Age=600`

**Validation**:
- [ ] `POST /api/auth/verify` with correct PIN returns `200` and sets `chores_session` cookie
- [ ] `POST /api/auth/verify` with wrong PIN returns `401` with generic error (no PIN hint)
- [ ] `GET /api/auth/session` with valid cookie returns `200` with `{ "data": { "valid": true } }`
- [ ] `GET /api/auth/session` with no cookie returns `401`
- [ ] `GET /api/admin/settings` (any admin endpoint) without session returns `401`
- [ ] `GET /api/admin/settings` with valid session returns `200`
- [ ] After 10 minutes of inactivity, session cookie is rejected (expiry not refreshed)
- [ ] Active use keeps session alive (expiry slides forward on each authenticated request)
- [ ] `POST /api/auth/lock` clears the cookie — subsequent `GET /api/auth/session` returns `401`
- [ ] `POST /api/auth/logout` deletes the session row — cookie is invalid even if re-sent
- [ ] Cookie has `HttpOnly` flag (not accessible via `document.cookie`)
- [ ] Cookie has `SameSite=Strict`
- [ ] Multiple concurrent admin sessions (different browsers) work independently

---

### 1.7 PIN Throttling

Rate-limit PIN attempts to prevent brute force.

**Work**:
- `packages/server/src/middleware/rateLimiter.ts`: in-memory `Map<string, { attempts: number[], cooldownUntil: Date | null }>`
- Applied only to `POST /api/auth/verify`
- Track failed attempt timestamps per IP. Prune entries older than 15 minutes on each check.
- After 5 failures in 15 minutes: cooldown. Escalation: 15min → 30min → 60min on repeated bursts.
- Return `429` with `Retry-After` header during cooldown.

**Validation**:
- [ ] First 5 incorrect PIN attempts return `401` (not throttled)
- [ ] 6th incorrect PIN attempt within 15 minutes returns `429`
- [ ] Response includes `Retry-After` header
- [ ] Error message is generic — no indication of whether PIN format or value was wrong
- [ ] Correct PIN still works after 4 failures (under threshold)
- [ ] After cooldown period expires, attempts are allowed again
- [ ] Different IPs are throttled independently
- [ ] Successful login does not count as a failed attempt

---

### 1.8 Vite + React Client Shell

Scaffold the frontend with routing, Tailwind, and empty page shells.

**Work**:
- `packages/client`: Vite + React + TypeScript + Tailwind CSS setup
- `vite.config.ts`: dev server proxy `/api` → `http://localhost:3000`
- React Router v7 with routes:
  - `/` → redirect to `/today`
  - `/today`, `/routines`, `/rewards`, `/me` → child tab shells (placeholder content)
  - `/admin/pin` → PIN entry screen
  - `/admin/*` → admin layout with `AdminGuard`
- `AdminGuard` component: calls `GET /api/auth/session` on mount, redirects to `/admin/pin` if invalid
- PIN entry screen: 6+ digit input, calls `POST /api/auth/verify`, redirects to `/admin` on success
- Child tab bar component: fixed bottom nav with 4 tabs, active state highlighting
- Admin nav: sidebar or top bar with links to admin sections (empty pages for now)
- Install and configure TanStack Query: `QueryClientProvider` wrapping the app
- `src/api/client.ts`: fetch wrapper that returns typed responses following the `{ data }` / `{ error }` contract
- `src/styles/globals.css`: Tailwind directives, CSS custom properties for design tokens
- `tailwind.config.ts`: tablet-first breakpoints, touch target sizing utilities

**Validation**:
- [ ] `npm run dev` from root starts both Vite (`:5173`) and Express (`:3000`)
- [ ] Opening `http://localhost:5173/` redirects to `/today`
- [ ] All 4 child tabs are visible and navigable (Today, Routines, Rewards, Me)
- [ ] Clicking "Admin" in footer navigates to `/admin/pin`
- [ ] Entering correct PIN unlocks admin view — admin nav is visible
- [ ] Entering wrong PIN shows error message (no PIN hint)
- [ ] Navigating to `/admin/routines` without a session redirects to `/admin/pin`
- [ ] After PIN login, navigating between admin sections works without re-entering PIN
- [ ] Tailwind classes render correctly (no unstyled content)
- [ ] `npm run build --workspace=packages/client` produces `dist/` with `index.html`
- [ ] Express serves the built client: `http://localhost:3000/` shows the app
- [ ] Deep link refresh works: `http://localhost:3000/rewards` serves the SPA (not 404)

---

### 1.9 Docker Setup

Create Dockerfile and docker-compose.yml for containerized deployment.

**Work**:
- `Dockerfile`: multi-stage build
  - Stage 1 (`deps`): Node 22 Alpine, copy package manifests, `npm ci`
  - Stage 2 (`build`): copy source, build shared → client → server
  - Stage 3 (`runtime`): Node 22 Alpine, `tini`, copy prod deps + built artifacts, `EXPOSE 3000`
- `docker-compose.yml`: single `app` service, named volume `chore-data` mounted at `/data`, env vars from `.env`
- `.dockerignore`: exclude `node_modules`, `dist`, `data`, `.git`, `.env`, logs
- `.env.example`: document all env vars with comments

**Validation**:
- [ ] `docker build -t chore-app .` completes without errors
- [ ] `docker compose up` starts the container
- [ ] `curl http://localhost:3000/api/health` returns `200` from the container
- [ ] `http://localhost:3000/` serves the React app from the container
- [ ] `/data` volume persists across container restarts: PIN login works after `docker compose down && docker compose up`
- [ ] `db.sqlite` is created inside the Docker volume (not in the image)
- [ ] `secrets/webpush.json` is created inside the Docker volume
- [ ] Container stops gracefully on `docker compose down` (tini handles SIGTERM)
- [ ] Rebuilding the image after code changes picks up the changes

---

### 1.10 CI Pipeline

Set up GitHub Actions for automated checks.

**Work**:
- `.github/workflows/ci.yml`:
  - Trigger on push to `main` and PRs to `main`
  - `check` job: checkout, setup Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test -- --run`
  - `docker` job (depends on `check`): checkout, `docker build`, smoke test (start container, curl health endpoint, stop)

**Validation**:
- [ ] Push to `main` triggers the CI workflow
- [ ] PR to `main` triggers the CI workflow
- [ ] `check` job passes: lint, typecheck, and tests all green
- [ ] `docker` job passes: image builds and health endpoint responds
- [ ] A failing test causes the `check` job to fail (red)
- [ ] A TypeScript error causes the `check` job to fail
- [ ] `docker` job does not run if `check` fails

---

### 1.11 Unit + Integration Tests — Foundation

Write automated tests for all foundation logic. Tests run with `npm run test` via Vitest.

**Work**:

**Test infrastructure setup**:
- `vitest.workspace.ts` at project root — Vitest workspace config that discovers and runs tests across all packages
- `packages/server/vitest.config.ts` — server test config (Node environment, path aliases, setup file reference)
- `packages/server/tests/setup.ts` — global test setup: in-memory DB factory, any shared beforeAll/afterAll hooks
- `packages/server/tests/db-helpers.ts` — `createTestDb()` returns a fresh `:memory:` DB with migrations applied; `seedTestData()` inserts common test fixtures (default settings, sample routines/chores/rewards). Each test suite gets an isolated DB instance.
- `packages/client/vite.config.ts` — add Vitest config for client tests (jsdom environment, setup file reference, path aliases)
- Install dev dependencies: `vitest`, `supertest`, `@types/supertest`

**Server unit tests** (using in-memory SQLite `:memory:`):

- `packages/server/tests/db/migrate.test.ts`:
  - Test: applying all migrations on a fresh `:memory:` DB succeeds
  - Test: running migrations twice is idempotent (second run applies nothing)
  - Test: all 14 expected tables exist after migration
  - Test: `_migrations` table records the applied version
  - Test: foreign keys are enforced (insert child row with missing parent fails)
  - Test: status CHECK constraints reject invalid values

- `packages/server/tests/lib/crypto.test.ts`:
  - Test: `hashPin("123456")` returns a string in `salt:hash` format
  - Test: `verifyPin("123456", hashedValue)` returns `true`
  - Test: `verifyPin("000000", hashedValue)` returns `false` (wrong PIN)
  - Test: two calls to `hashPin` with the same PIN produce different hashes (unique salts)

- `packages/server/tests/services/settingsService.test.ts`:
  - Test: `bootstrapSettings(db, config)` inserts defaults when settings table is empty
  - Test: `bootstrapSettings(db, config)` does nothing when settings already exist
  - Test: `getSetting(db, "timezone")` returns the configured timezone
  - Test: default time slot windows match spec §7.3

- `packages/server/tests/services/authService.test.ts`:
  - Test: `verifyPin(db, correctPin)` returns a session token
  - Test: `verifyPin(db, wrongPin)` throws an error
  - Test: `createSession(db)` inserts a row in `admin_sessions`
  - Test: `validateSession(db, token)` returns session data for a valid token
  - Test: `validateSession(db, token)` throws for an expired session (expires_at in the past)
  - Test: `validateSession(db, token)` extends `expires_at` on successful validation (sliding window)
  - Test: `destroySession(db, tokenHash)` removes the session row
  - Test: `destroyAllSessions(db)` clears all rows

- `packages/server/tests/middleware/rateLimiter.test.ts`:
  - Test: first 5 requests from same IP are allowed
  - Test: 6th request within 15 minutes returns `429`
  - Test: requests from a different IP are independent
  - Test: after cooldown expires, requests are allowed again
  - Test: successful PIN verify does not count as a failure

**Server integration tests** (via supertest):

- `packages/server/tests/routes/auth.test.ts`:
  - Test: `POST /api/auth/verify` with correct PIN returns `200` + sets cookie
  - Test: `POST /api/auth/verify` with wrong PIN returns `401`
  - Test: `GET /api/auth/session` with valid cookie returns `200`
  - Test: `GET /api/auth/session` without cookie returns `401`
  - Test: `POST /api/auth/lock` clears the cookie
  - Test: `POST /api/auth/logout` invalidates the session
  - Test: `GET /api/admin/settings` without session returns `401`
  - Test: `GET /api/admin/settings` with valid session returns `200`

- `packages/server/tests/routes/health.test.ts`:
  - Test: `GET /api/health` returns `200` with expected body
  - Test: `GET /api/nonexistent` returns `404` with error envelope

**Client component tests** (Vitest + React Testing Library):

- `packages/client/tests/features/admin/pin/PinEntry.test.tsx`:
  - Test: renders PIN input field
  - Test: submitting correct PIN navigates to admin view (mock API)
  - Test: submitting wrong PIN shows error message
  - Test: shows throttle message when API returns `429`

**Validation**:
- [ ] `npm run test -- --run` passes with all tests green from the root (vitest workspace runs both packages)
- [ ] `npm run test --workspace=packages/server` runs only server tests
- [ ] `npm run test --workspace=packages/client` runs only client tests
- [ ] Server unit tests use in-memory SQLite via `createTestDb()` — no file system state between tests
- [ ] Each test file is independent — can run in any order
- [ ] `db-helpers.ts` provides a fresh migrated DB per test suite
- [ ] Tests cover: migration runner, PIN hashing, settings bootstrap, session lifecycle, rate limiting
- [ ] Integration tests cover: auth flow end-to-end, error response format, admin auth middleware
- [ ] Client tests cover: PIN entry screen behavior
- [ ] A broken migration causes the migration test to fail
- [ ] A broken PIN hash function causes the crypto test to fail
