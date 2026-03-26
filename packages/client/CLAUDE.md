# Client Package

React 18 + Vite + TypeScript + Tailwind SPA. Designed for a child using an iPad as a home screen PWA.

## Commands

```bash
npm run dev -w packages/client    # Vite dev server (proxies /api to :3000)
npm run build -w packages/client  # Production build to dist/
npm run test -- --run --project client  # Client tests only
```

## Architecture

- **Features**: Domain-specific components in `features/{child|admin}/...`. Each domain's `*Screen` component is the primary tab route target; additional routes (e.g., nested or detail views) may use other components. Where most UI logic lives.
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
- All API calls use AbortController + setTimeout timeout (10s). On timeout, treat as network error.
- TanStack Query mutations use retry: 2 with exponential backoff for transient failures.

## Drafts & Offline

- Checklist drafts stored in IndexedDB via idb. Schema: routineId, items, idempotencyKey, startedAt, submissionFailed.
- On resume: re-fetch routine, compare checklist item IDs. If changed, discard stale draft and show toast.
- Shuffle button disabled once any checklist item is checked.
- On online event: retry any drafts with submissionFailed=true using stored idempotencyKey. Delete on 200/409.
- On 409 archived from server: delete draft, show toast, navigate back.

## Design System

### Fonts

- **Display font** (`font-display`): Fredoka -- used for all headings (h1-h3), large numbers (points), CTAs, and badges. Loaded via Google Fonts in `index.html`.
- **Body font** (`font-body`): Inter -- used for body text, labels, metadata. Falls back to system fonts.
- Never use raw `font-sans` or system defaults for headings. Always apply `font-display` to h1, h2, h3 elements and primary action buttons.

### Color Tokens

All colors MUST use CSS custom properties defined in `styles/globals.css`. Never use raw Tailwind color classes (e.g., `bg-gray-50`, `text-amber-700`) -- always use `bg-[var(--color-bg)]`, `text-[var(--color-amber-700)]`, etc. This enables dark mode and Smart Invert support.

**Semantic tokens** (adapt to light/dark automatically):
- `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-surface-elevated`
- `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-text-faint`
- `--color-border`, `--color-border-light`

**Accent tokens** (have dark mode overrides in globals.css):
- Amber: `--color-amber-50` through `--color-amber-700` (points, CTAs, brand)
- Emerald: `--color-emerald-50` through `--color-emerald-700` (completions, success)
- Sky: `--color-sky-50` through `--color-sky-700` (routines domain)
- Violet: `--color-violet-50` through `--color-violet-500` (badges)
- Red: `--color-red-600` (errors, destructive actions)

**When adding new colors**: add both light and dark values to `globals.css` `:root` and `@media (prefers-color-scheme: dark)` blocks. Do not add one without the other.

### Domain Colors

Each domain has a visual identity maintained across child and admin screens:
- **Routines**: Sky blue (left borders, slot badges, activity dots)
- **Chores**: Amber/orange (tier badges, activity dots)
- **Rewards/Points**: Amber gradient (PointsDisplay), amber CTAs
- **Badges**: Violet (earned glow, activity dots)

### Dark Mode & Smart Invert

- `color-scheme: light dark` is set on `:root` -- iOS Smart Invert respects this.
- Dark mode values are defined in `@media (prefers-color-scheme: dark)` in globals.css.
- Emoji elements must have `data-emoji` attribute -- CSS rule `[data-emoji] { color-scheme: light; }` prevents double-inversion.
- Never use `dark:` Tailwind prefix for colors that have token equivalents. The tokens handle the switch.
- Use `dark:` prefix ONLY for Tailwind classes that don't have token equivalents (e.g., `dark:from-violet-900/50` on badge glow gradients).

### Shadows

Use semantic shadow tokens from `tailwind.config.ts`, not raw Tailwind shadows:
- `shadow-card` -- standard card elevation
- `shadow-elevated` -- hover/active card state
- `shadow-toast` -- toast/overlay notifications
- `shadow-glow-amber`, `shadow-glow-emerald`, `shadow-glow-violet` -- colored glow effects

### Component Patterns

- **Cards**: `rounded-3xl bg-[var(--color-surface)] shadow-card`
- **Points pills**: `font-display font-bold text-[var(--color-amber-700)] bg-[var(--color-amber-50)] border border-amber-200 rounded-full`
- **Section headers**: `font-display text-lg font-semibold text-[var(--color-text-secondary)]`
- **Error states**: Always include retry action, use `font-display font-bold` on retry button
- **Loading skeletons**: Match shape of actual content, use `bg-[var(--color-surface-muted)]` with `animate-pulse`
- **Empty states**: Centered text with emoji (`data-emoji` attribute), `font-display` for heading

### Admin vs Child

- Both share the same design tokens, fonts, and domain colors.
- **Child screens**: Bottom tab nav, full-bleed layout, `rounded-3xl` cards, larger touch targets, playful tone.
- **Admin screens**: Top horizontal nav in `AdminLayout`, `max-w-5xl` centered content, data tables for lists, standard form inputs. Functional/scannable tone.
- Admin brand accent is amber (not indigo). Consistent with child side.

## Styling

- Tailwind utility classes. Custom CSS only in `styles/globals.css` for base-level concerns.
- Custom breakpoints: `tablet` (768px), `desktop` (1024px).
- Touch-friendly sizing utilities: `min-h-touch`, `min-w-touch` (44px).
- Global `:focus-visible` indicator uses amber outline (2px, 2px offset).

## Testing

- Test directory: `tests/` (mirrors `src/` structure)
- Use Testing Library (`@testing-library/react`) with `userEvent` for interactions.
- MSW for mocking API responses -- don't mock `fetch` directly.
- Test all component states: loading, success, error, empty.
- Components with auth logic (guards, protected routes) must have dedicated tests.
- Bootstrap mocks use partial matching — each PR only mocks the fields it introduced. BootstrapData uses optional fields for properties added in later PRs.
- Tests must be self-contained per PR. A test added in PR 1b must not break when PR 3 adds new fields or features. Use optional types and partial mocks to ensure forward compatibility.
