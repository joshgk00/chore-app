# Architecture Decisions

**Project**: Chores App v1
**Date**: 2026-03-18

This document captures the key technical decisions for the Chores app, the reasoning behind each, and the alternatives that were considered.

---

## AD-1: Monorepo with npm Workspaces

**Decision**: Use a single repo with three npm workspaces: `packages/client`, `packages/server`, `packages/shared`.

**Why**: The client and server are deployed in the same container and share types/constants. A monorepo keeps them in sync without publishing packages. npm workspaces are built-in (zero extra tooling) and sufficient for three packages.

**Alternatives considered**:
- **Flat structure (no workspaces)**: Simpler, but client and server would share a single `package.json` with mixed dependencies, making the Docker build less efficient and dependency management unclear.
- **Nx or Turborepo**: Powerful build caching and task orchestration, but overkill for a 3-package project with a single developer. Adds config complexity without meaningful benefit at this scale.

---

## AD-2: TypeScript Everywhere

**Decision**: Use TypeScript for both client and server.

**Why**: Full-stack type safety catches bugs early — especially important for shared API contracts (response shapes, status enums). IDE support (autocomplete, go-to-definition) speeds up development. The build step cost is minimal with modern tooling (Vite for client, `tsc` for server, `tsx` for dev).

**Alternatives considered**:
- **JavaScript with JSDoc types**: No build step for server, but weaker type checking, no shared type imports, and worse IDE experience for cross-package references.

---

## AD-3: Tailwind CSS for Styling

**Decision**: Use Tailwind CSS for all frontend styling.

**Why**: Fast to build tablet-first responsive UIs with utility classes. Built-in responsive modifiers (`md:`, `lg:`) map naturally to the tablet-first breakpoint strategy. Large ecosystem of patterns and resources. No runtime cost (compiled away by Vite).

**Alternatives considered**:
- **CSS Modules**: Zero-runtime, automatic scoping, full media query control. A solid choice, but slower to iterate on layout compared to Tailwind's utility approach.
- **Plain CSS with BEM**: Simplest setup, but manual scoping and naming conventions add friction as the component count grows.

---

## AD-4: React Router v7

**Decision**: Use React Router v7 for client-side routing.

**Why**: Industry standard, well-documented, handles nested layouts cleanly. The child tab layout and admin guard pattern map directly to React Router's nested route model. No learning curve for anyone joining the project.

**Alternatives considered**:
- **TanStack Router**: More type-safe routing, but smaller community and less documentation. Not worth the adoption cost for a straightforward route structure.

---

## AD-5: TanStack Query for Data Fetching

**Decision**: Use TanStack Query v5 for all server state management.

**Why**: The app is fundamentally a server-state consumer. TanStack Query handles caching, background refetching, loading/error states, and mutation invalidation out of the box. Its `useMutation` with `onSuccess` cache invalidation maps perfectly to the approval and submission flows. Eliminates the need for a global state store.

**Alternatives considered**:
- **SWR**: Lighter, but weaker mutation support. Approval flows need `useMutation` with cache invalidation, which SWR doesn't handle as cleanly.
- **Plain fetch + useState**: No library overhead, but requires manually reimplementing caching, refetch-on-focus, loading states, and stale data handling. High effort for low benefit.

---

## AD-6: No Global State Store

**Decision**: No Redux, Zustand, or other global state library. Use TanStack Query for server state, React local state for UI state, and two small React Contexts (online status, admin session).

**Why**: This is a single-user app with no complex client-side state transitions. TanStack Query owns all server-derived data. The only cross-cutting client state is "are we online?" and "is admin unlocked?" — both fit in a simple context. Adding a state store would be unused overhead.

**Alternatives considered**:
- **Zustand**: Lightweight, but there's nothing to put in it. All meaningful state comes from the server.

---

## AD-7: better-sqlite3 with Synchronous Transactions

**Decision**: Use `better-sqlite3` (synchronous API) as the database driver, not an async alternative.

**Why**: The synchronous API makes transactions trivial and bulletproof. A `db.transaction()` call wraps a plain function in BEGIN/COMMIT/ROLLBACK — no async gaps where concurrent writes could interleave. This is critical for the approval workflow (status update + ledger entry + badge evaluation must be atomic). SQLite itself serializes writes, so the synchronous API matches the database's actual behavior.

**Alternatives considered**:
- **sql.js (WASM)**: Runs in any environment but slower and more memory-intensive than native better-sqlite3.
- **Knex/Drizzle ORM**: Adds a query builder or ORM layer. For 14 tables with straightforward queries, raw SQL is more readable and avoids ORM abstractions that obscure what's happening at the database level.
- **Prisma**: Heavy, async-only, and would fight against SQLite's synchronous nature. Generates its own migration system. Overkill for this project.

---

## AD-8: Numbered SQL Migration Files

**Decision**: Use numbered `.sql` files (`001-initial-schema.sql`, `002-add-index.sql`, etc.) with a custom migration runner that tracks applied versions in a `_migrations` table.

**Why**: Simple, transparent, and gives full control over the schema. The migration runner is ~30 lines of code. SQL files are readable, diffable, and don't require learning a migration DSL. Since this is a single-instance app that migrates at startup, there are no rolling-deploy concerns.

**Alternatives considered**:
- **Prisma Migrate**: Ties schema management to Prisma's ORM, which we're not using.
- **knex migrations**: Requires Knex as a dependency just for migrations. JavaScript migration files add a layer of indirection over raw SQL.
- **umzug**: A dedicated migration library — reasonable, but the custom runner is simple enough that adding a dependency isn't justified.

---

## AD-9: Admin Auth via PIN + HTTP-Only Cookie

**Decision**: Admin authenticates with a numeric PIN. The server issues a signed session token stored in an HTTP-only, secure, same-site cookie. Sessions have a 10-minute sliding inactivity timeout.

**Why**: A PIN is the right UX for a family app — fast to enter on a tablet, no username/password to remember. HTTP-only cookies prevent XSS from stealing the token. Same-site=Strict prevents CSRF. The session table in SQLite means no Redis or external session store. The 10-minute sliding timeout and 1-minute background lock (client-side) balance security with usability.

**Alternatives considered**:
- **JWT (stateless)**: Can't revoke individual sessions without a blocklist (which is just a session store with extra steps). The session table is simpler and supports "invalidate all on PIN change."
- **Password instead of PIN**: Higher friction for the same security level in this context. The app is already behind a private URL (Cloudflare Tunnel). PIN + throttling is sufficient.

---

## AD-10: scryptSync for PIN Hashing

**Decision**: Use Node.js built-in `crypto.scryptSync` for PIN hashing. Store as `salt:hash` in the settings table.

**Why**: scrypt is a memory-hard KDF suitable for password/PIN hashing. It's built into Node.js — no native addon required. This matters for Docker builds (no compilation step for bcrypt/argon2 on Alpine). For a single PIN with throttling (5 attempts per 15 minutes), scrypt is more than adequate.

**Alternatives considered**:
- **argon2**: Stronger, but requires a native addon (`argon2` npm package) that needs compilation. Adds Docker build complexity.
- **bcrypt**: Also requires native compilation. scrypt is equally secure for this use case and built-in.

---

## AD-11: In-Memory PIN Rate Limiting

**Decision**: Track PIN attempt history in an in-memory `Map<ip, timestamps[]>`. No persistent rate limit state.

**Why**: Single-process, single-container architecture means in-memory state is sufficient. Rate limit state is inherently ephemeral — it resets on restart, which is acceptable for a family app. Persisting rate limit state to SQLite adds complexity without meaningful security benefit (an attacker with physical access can just restart the container).

**Alternatives considered**:
- **express-rate-limit**: A library that does essentially the same thing but adds a dependency. The custom implementation is ~40 lines.
- **Redis-backed rate limiting**: Requires Redis. Not justified for a single-process app.

---

## AD-12: Idempotency via UNIQUE Constraint

**Decision**: Idempotency keys are stored as `UNIQUE` columns on mutation tables (`routine_completions`, `chore_logs`, `reward_requests`). On duplicate key, return the existing record.

**Why**: The simplest correct approach. The UNIQUE constraint is enforced by SQLite — no application-level race conditions. With better-sqlite3's synchronous execution, two requests with the same key serialize naturally. No separate idempotency table or TTL cleanup needed, since keys are permanent (one per record).

**Alternatives considered**:
- **Separate idempotency table with TTL**: More generic, but adds a table and a cleanup job for no benefit. Keys are lightweight and useful for audit.

---

## AD-13: `idb` for IndexedDB (Routine Drafts)

**Decision**: Use the `idb` library (~1KB gzipped) for IndexedDB access in the routine draft/resume flow.

**Why**: The raw IndexedDB API is callback-based and verbose. `idb` wraps it in promises with the same API shape — minimal learning curve, minimal bundle size. Only one feature (routine drafts) uses IndexedDB, so a heavier library like Dexie is unnecessary.

**Alternatives considered**:
- **Dexie.js**: More features (live queries, middleware), but ~10x the bundle size for a single object store.
- **Raw IndexedDB API**: Works, but the callback-based API is error-prone and harder to test.
- **localStorage**: The spec explicitly calls for IndexedDB. Also, localStorage has a 5MB cap and can't store structured data without serialization.

---

## AD-14: vite-plugin-pwa for Service Worker

**Decision**: Use `vite-plugin-pwa` in `generateSW` mode with Workbox strategies for caching.

**Why**: Generates the service worker and injects the precache manifest automatically from the Vite build. Workbox provides well-tested caching strategies (NetworkFirst for API, CacheFirst for assets) without hand-writing service worker code. The plugin handles cache versioning and update prompts.

**Alternatives considered**:
- **Hand-written service worker**: Full control, but maintaining cache versioning and strategy logic by hand is error-prone and well-solved by Workbox.
- **next-pwa or similar**: Framework-specific, not applicable to Vite.

---

## AD-15: Single Docker Container with tini

**Decision**: Single container serves frontend (static), backend (Express), database (SQLite), and background jobs. Use `tini` as PID 1 for proper signal handling.

**Why**: The spec mandates a single container. SQLite requires a single process for write safety. `tini` forwards SIGTERM correctly, allowing the app to close the SQLite connection gracefully on shutdown (preventing WAL corruption). The retention job runs in-process via `setInterval` rather than as a separate cron container.

**Alternatives considered**:
- **nginx + Node.js in one container**: Adds nginx config complexity for no benefit — Express serves static files efficiently enough for a single-user app.
- **Separate containers for frontend and backend**: Would require a shared SQLite volume with careful locking. Not worth the complexity.

---

## AD-16: Node 22 Alpine Base Image

**Decision**: Use `node:22-alpine` for all Docker stages.

**Why**: Node 22 is the current LTS (as of 2026). Alpine keeps the image small (~50MB vs ~350MB for Debian). `better-sqlite3` and `sharp` both ship prebuilt binaries for Alpine/musl, so no compilation tools are needed in the runtime stage.

**Alternatives considered**:
- **node:22-slim (Debian)**: Larger image, but avoids potential musl compatibility issues. Kept as a fallback if Alpine binaries cause problems.

---

## AD-17: Vitest for Testing

**Decision**: Use Vitest for both client and server tests.

**Why**: Vitest integrates natively with Vite (shared config, same transform pipeline). It runs TypeScript without extra setup. Using the same test runner for both packages reduces cognitive overhead. It's fast (parallel, HMR-aware in watch mode) and compatible with React Testing Library and `supertest`.

**Alternatives considered**:
- **Jest**: Well-established, but requires separate TypeScript transform config and doesn't share Vite's pipeline. Slower startup.
- **Node built-in test runner**: Zero dependencies, but no Vite integration for client-side tests and limited assertion library.

---

## AD-18: sharp for Image Processing

**Decision**: Use `sharp` for all server-side image processing (orientation fix, resize, compress, WebP conversion, metadata stripping).

**Why**: `sharp` is the fastest Node.js image processing library (built on libvips). It handles the full processing pipeline in a single chain: orient → resize → convert → strip. Prebuilt binaries are available for Alpine Linux, so no compilation required.

**Alternatives considered**:
- **Jimp**: Pure JavaScript, no native dependencies. But 10-50x slower than sharp for the same operations, which matters when processing 5MB uploads.
- **ImageMagick via shell**: Requires installing ImageMagick in the container. More complex, harder to test, and sharp's API is more ergonomic.

---

## AD-19: Points as Aggregated Ledger, Not Cached Balance

**Decision**: Point balances (total, reserved, available) are computed from the ledger and pending requests on every read. No cached balance column.

**Why**: The ledger is small (single child, maybe hundreds of entries over a year). Aggregating with `SUM()` takes microseconds in SQLite. A cached balance would require keeping it in sync with every ledger mutation — a source of bugs for zero performance benefit at this scale. The spec explicitly states the ledger is the source of truth.

**Alternatives considered**:
- **Cached balance column updated on each transaction**: Faster reads, but introduces a consistency risk. If the cache diverges from the ledger, the system is untrustworthy. Not worth it for sub-millisecond aggregates.

---

## AD-20: Snapshot-on-Submit for Historical Records

**Decision**: All pending and historical records (routine completions, chore logs, reward requests) store snapshot values captured at submission time. Parent edits after submission never alter snapshots.

**Why**: This is a spec requirement (§10.4) and a trust/auditing fundamental. If a parent changes a routine's point value from 10 to 15, pending completions at 10 points should still show and award 10 points. The approval UI shows what the child actually did, not the current configuration.

**Implementation**: Snapshot columns are denormalized onto the mutation tables (`routine_name_snapshot`, `points_snapshot`, etc.). This is intentional duplication — the alternative (joining to the parent table) would return current values, not historical ones.
