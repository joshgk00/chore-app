# Client Package

React 18 + Vite + TypeScript + Tailwind SPA. Designed for a child using an iPad as a home screen PWA.

## Commands

```bash
npm run dev -w packages/client    # Vite dev server (proxies /api to :3000)
npm run build -w packages/client  # Production build to dist/
npm run test -- --run --project client  # Client tests only
```

## Architecture

- **Pages**: Top-level route components in `pages/`. Minimal logic -- delegate to features/components.
- **Features**: Domain-specific components in `features/{domain}/`. Where most UI logic lives.
- **Components**: Shared/reusable UI components in `components/`.
- **Layouts**: Page chrome (nav, guards) in `layouts/`.
- **API**: All server calls go through `api/client.ts` which returns `ApiResult<T>` discriminated unions.

## Accessibility (WCAG AA)

This app will be used by a child, potentially with assistive technology. Accessibility is not optional.

- Every page must be wrapped in a `<main>` landmark.
- Navigation elements (`<nav>`) must have unique `aria-label` attributes (e.g., `aria-label="Main navigation"`).
- Active navigation items must use `aria-current="page"`.
- Include a skip navigation link as the first focusable element.
- Error messages must be linked to their input via `aria-describedby`.
- Loading states must use `aria-live="polite"` regions for screen reader announcement.
- Form inputs auto-focus on mount when they're the primary interaction.
- Minimum touch target: 44x44px (enforced in global CSS).
- Text contrast: meet WCAG AA ratio (4.5:1 for normal text, 3:1 for large). Avoid `text-gray-500` on white at small sizes.
- Checklist items: role="checkbox" with aria-checked. State changes use color + checkmark icon (not color alone).

## React Patterns

- Use TanStack React Query for all server state. Don't bypass it with raw fetch in components.
- Add React error boundaries to catch render crashes. At minimum, one at the app root.
- Keep components focused. If a component handles both data fetching and rendering, split it.
- Use the `ApiResult<T>` union from `api/client.ts` -- always handle the `ok: false` branch.

## Submission UX

- All submit buttons are disabled during in-flight requests (prevent double-tap).
- All submit buttons are disabled when offline (gated by useOnline() from OnlineContext).
- Destructive or costly actions (e.g. spending points) require a confirmation dialog before the POST fires.
- All API calls use AbortSignal.timeout(10_000). On timeout, treat as network error.
- TanStack Query mutations use retry: 2 with exponential backoff for transient failures.

## Drafts & Offline

- Checklist drafts stored in IndexedDB via idb. Schema: routineId, items, idempotencyKey, startedAt, submissionFailed.
- On resume: re-fetch routine, compare checklist item IDs. If changed, discard stale draft and show toast.
- Shuffle button disabled once any checklist item is checked.
- On online event: retry any drafts with submissionFailed=true using stored idempotencyKey. Delete on 200/409.
- On 409 archived from server: delete draft, show toast, navigate back.

## Styling

- Tailwind utility classes. Custom CSS only in `styles/globals.css` for base-level concerns.
- Custom breakpoints: `tablet` (768px), `desktop` (1024px).
- Touch-friendly sizing utilities: `min-h-touch`, `min-w-touch` (44px).

## Testing

- Test directory: `tests/` (mirrors `src/` structure)
- Use Testing Library (`@testing-library/react`) with `userEvent` for interactions.
- MSW for mocking API responses -- don't mock `fetch` directly.
- Test all component states: loading, success, error, empty.
- Components with auth logic (guards, protected routes) must have dedicated tests.
- Bootstrap mocks use partial matching — each PR only mocks the fields it introduced. BootstrapData uses optional fields for properties added in later PRs.
- Tests must be self-contained per PR. A test added in PR 1b must not break when PR 3 adds new fields or features. Use optional types and partial mocks to ensure forward compatibility.
