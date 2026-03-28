import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthErrorRedirect } from '../../src/hooks/useAuthErrorRedirect.js';
import type { AuthErrorHandler } from '../../src/api/client.js';

let capturedHandler: AuthErrorHandler | null = null;
vi.mock('../../src/api/client.js', () => ({
  setOnAuthError: (handler: AuthErrorHandler | null) => {
    capturedHandler = handler;
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function TestComponent() {
  useAuthErrorRedirect();
  return <div>Admin Content</div>;
}

function renderHook(initialRoute = '/admin/chores') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <TestComponent />
    </MemoryRouter>,
  );
}

describe('useAuthErrorRedirect', () => {
  afterEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
  });

  it('registers an auth error handler on mount', () => {
    renderHook();
    expect(capturedHandler).toBeTypeOf('function');
  });

  it('navigates to PIN entry with encoded returnTo on auth error', () => {
    renderHook('/admin/chores/new');

    act(() => {
      capturedHandler!('/api/admin/chores');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/admin/pin?returnTo=%2Fadmin%2Fchores%2Fnew',
      { replace: true },
    );
  });

  it('preserves query params in returnTo path', () => {
    renderHook('/admin/activity?page=2&type=chore');

    act(() => {
      capturedHandler!('/api/admin/activity-log');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('returnTo='),
      { replace: true },
    );

    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
    const returnTo = decodeURIComponent(navigatedUrl.split('returnTo=')[1]);
    expect(returnTo).toBe('/admin/activity?page=2&type=chore');
  });

  it('clears the handler on unmount', () => {
    const { unmount } = renderHook();
    expect(capturedHandler).toBeTypeOf('function');

    unmount();
    expect(capturedHandler).toBeNull();
  });
});
