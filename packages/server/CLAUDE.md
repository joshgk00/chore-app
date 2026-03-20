# Server Package

Express + TypeScript API server with SQLite (better-sqlite3).

## Commands

```bash
npm run dev -w packages/server    # tsx watch mode
npm run build -w packages/server  # Compile to dist/
npm run test -- --run --project server  # Server tests only
```

## Layers

`routes/ -> services/ -> db/` -- each layer has a single responsibility:

- **Routes**: Parse request, call service, shape response, set cookies. Always try-catch with `next(err)`.
- **Services**: Business logic, DB queries, validation. Accept `db` and `config` as parameters (no singletons).
- **Middleware**: Cross-cutting concerns (auth, rate limiting, error handling). Must be independently testable.
- **lib/**: Utilities (crypto, errors). Pure functions where possible.

## Patterns to Follow

### Route Handlers

Every route handler follows this shape:

```typescript
router.post("/endpoint", async (req, res, next) => {
  try {
    // call service, return response
  } catch (err) {
    next(err);
  }
});
```

Never skip the try-catch. The error handler middleware depends on `next(err)`.

### Database

- Cache prepared statements at module scope or service init, not inline per call.
- Use transactions for multi-statement operations.
- All queries use `?` parameterized placeholders. No string interpolation in SQL.
- Migrations in `src/db/migrations/` are numbered sequentially and idempotent (`IF NOT EXISTS`).

### Crypto

- Use async `crypto.scrypt()` (callback/promisified), never `scryptSync`. Sync blocks the event loop for ~100-200ms.
- Use `crypto.timingSafeEqual` for all secret comparisons. Guard against length mismatch before comparing.
- Session tokens: 32 random bytes, store only SHA-256 hash.

### Error Handling

- Throw `AppError` subclasses (`ValidationError`, `AuthError`, `NotFoundError`, `ConflictError`) from services.
- The centralized `errorHandler` middleware converts these to structured JSON responses.
- Process-level handlers (`unhandledRejection`, `uncaughtException`) must exist in the entry point.
- Wrap the startup init sequence in try-catch -- a failed migration or missing env var shouldn't crash silently.

### Configuration

- Required env vars must fail fast at startup with a clear message.
- Use descriptive names for config keys (`imageGenApiKey`, not `ppqApiKey`).

## Testing

- Test directory: `tests/` (mirrors `src/` structure)
- Use `createTestDb()` from `tests/db-helpers.ts` for isolated in-memory databases per test.
- Use `supertest` against `createApp(db, config)` for integration tests.
- Middleware must have dedicated test files -- don't rely on indirect coverage through route tests.
- Test rate limiter escalation, session expiry, and edge cases (malformed input, missing fields).
