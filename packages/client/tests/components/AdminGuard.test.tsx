import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminGuard from '../../src/components/AdminGuard.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithRouter(initialRoute = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<div data-testid="admin-content">Admin Page</div>} />
        </Route>
        <Route path="/admin/pin" element={<div data-testid="pin-page">PIN Entry</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminGuard', () => {
  it('shows loading state with aria-live region while checking session', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    renderWithRouter();

    const loading = screen.getByRole('status');
    expect(loading).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/checking session/i)).toBeInTheDocument();
  });

  it('renders child route when session is valid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { valid: true } }),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });

  it('redirects to /admin/pin when session is invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('pin-page')).toBeInTheDocument();
    });
    expect(screen.getByText('PIN Entry')).toBeInTheDocument();
  });

  it('redirects to /admin/pin on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('pin-page')).toBeInTheDocument();
    });
  });
});
