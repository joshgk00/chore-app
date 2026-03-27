# Chore App

Self-hosted PWA for family chore/routine tracking. Single child, single admin PIN, runs as an iOS home screen app on a tablet behind Cloudflare Tunnel.

**Stack**: React + Vite + TS + Tailwind (client), Node + Express + TS (server), SQLite via better-sqlite3, Docker.

## Commands

```bash
npm run dev          # Start server + client concurrently
npm run build        # Build shared -> client -> server
npm run lint         # ESLint across all packages
npm run typecheck    # TypeScript build check
npm run test -- --run # Vitest, all packages, single run
npm run test:e2e     # Playwright E2E tests (starts dev server)
npm run test:e2e:ui  # Playwright with interactive UI
```

### Verification (run before every PR)

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run test:e2e
```

All four must pass. Do not skip E2E tests -- they catch integration issues that unit tests miss (rate limiter scope, offline behavior, mutation sequencing).

## Architecture

```
packages/shared   (types, constants -- zero runtime deps)
    ^                ^
    |                |
packages/server    packages/client
(Express+SQLite)   (React+Vite+TanStack Query)
```

- Dependency direction: shared has no deps. Server and client depend on shared. Never the reverse.
- Server layers: `routes -> services -> db`. Routes handle HTTP. Services hold business logic. No layer skipping.
- Route and service modules use factory functions (`createAuthRoutes(db, config)`) for testability.
- Client uses TanStack React Query for server state management.
- React context providers should have a single responsibility. Domain logic (draft sync, data fetching) belongs in hooks that consume the context, not inside the provider itself.

## Coding Standards

### Naming

- Functions: verb-led (`createSession`, `validateSession`, `bootstrapSettings`)
- Route factories: `create{Domain}Routes`
- Booleans: prefix with `is`/`has`/`should` (`isVerified`, not `verified`)
- Constants: `SCREAMING_SNAKE` with full words (`SESSION_DURATION_MINUTES`, not `SESS_DUR_MIN`)
- No opaque abbreviations -- prefer `imageGenApiKey` over `ppqApiKey`
- Files: kebab-case for multi-word (`rate-limiter.ts`), PascalCase for React components (`PinEntry.tsx`)

### Comments

- Code should be self-documenting through descriptive names.
- Only add comments to explain WHY, never WHAT.
- Good: `// scrypt cost tuned for sub-100ms on target hardware`
- Bad: `// Hash the PIN`, `// Create the session`, `// Return the response`

### Error Handling

- Custom errors extend `AppError` hierarchy in `packages/server/src/lib/errors.ts`.
- Every Express route handler must be wrapped in try-catch with `next(err)`.
- Never leak stack traces or internal details to clients.
- Use the discriminated union `ApiResult<T>` pattern on the client (`{ ok: true; data } | { ok: false; error }`).
- Side-effect operations (activity logging, analytics, notifications) must be wrapped in try-catch -- they should never crash the primary business operation.
- Client-side IndexedDB operations need try-catch with safe fallbacks. Safari iOS PWA mode has known storage quirks (quota limits, private browsing restrictions, database corruption).

### Security

- Never expose sensitive data in API responses. Always filter (e.g., strip `admin_pin_hash` from settings).
- Use parameterized queries for all SQL (`?` placeholders, never string interpolation).
- Use async crypto (`crypto.scrypt`) instead of sync variants to avoid blocking the event loop.
- Cookies: `httpOnly`, `sameSite: 'strict'`, `secure` in production.

### Performance

- Cache `db.prepare()` statements -- don't re-create them on every call.
- Clean up in-memory stores (rate limiter maps, expired sessions) on intervals.
- Use SQLite pragmas for performance (WAL mode, cache_size, mmap).

### Testing

- Tests live in `packages/{pkg}/tests/`, mirroring the `src/` structure. Never colocate tests with source.
- Every new module needs tests. Cover both happy path and error cases.
- Server tests use in-memory SQLite via `createTestDb()` from `tests/db-helpers.ts`.
- Client tests use Testing Library + jsdom. MSW available for API mocking.
- Extract shared test setup into helper functions at the top of the file or in shared helpers.
- Test middleware and API client code -- these are critical paths.

### E2E Testing (Playwright)

- E2E tests live in `e2e/` at the project root with shared helpers in `e2e/helpers/`.
- Playwright config uses an isolated `data-e2e/` database directory -- never share the dev database.
- Use serial mode with a shared `Page` instance for stateful CRUD flows that build on each other. Group truly independent tests (offline, idempotency) separately when possible.
- Append `Date.now()` to test entity names for uniqueness across runs against the persistent database.
- Scope assertions to specific rows/containers (`locator("tr", { hasText: name })`) -- never assert on bare text that could collide with data from prior runs.
- Prefer role and label selectors (`getByRole`, `getByLabel`) over CSS selectors.
- After mutation clicks, use `waitForResponse` to confirm the API call completed before asserting UI state.
- The submission rate limiter is mounted at `/api` and accidentally catches admin routes (known bug). E2E tests that make many sequential API calls need `paceForRateLimiter()` delays between bursts.

### Submission & Data Integrity
- Every write mutation wraps all steps in a single db.transaction() — from idempotency check through activity event. If any step fails, everything rolls back.
- Insert ordering: entity record → ledger entry → badge evaluation → activity event.
- All POST mutations are idempotent via idempotencyKey. Duplicates return the existing record, never error.
- Snapshot fields capture entity state at submission time and are immutable after that.
- Point balance is always aggregated live from points_ledger and pending reward_requests — no cached balance.
- Cancel operations are idempotent: re-canceling returns the existing canceled record.
- Destructive or costly user actions require confirmation before the POST fires.
- See package-level CLAUDE.md files for implementation details.

## Specs & Docs

- Feature spec: `docs/chores-spec-v1_1.md`
- Architecture decisions: `docs/architecture-decisions.md`
- Milestone plans: `docs/milestones/`
