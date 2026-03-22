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

## React Patterns

- Use TanStack React Query for all server state. Don't bypass it with raw fetch in components.
- Add React error boundaries to catch render crashes. At minimum, one at the app root.
- Keep components focused. If a component handles both data fetching and rendering, split it.
- Use the `ApiResult<T>` union from `api/client.ts` -- always handle the `ok: false` branch.

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
