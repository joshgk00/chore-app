import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../msw/server.js';
import AdminGuard from '../../src/components/AdminGuard.js';

function PinPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  return (
    <div data-testid="pin-page">
      PIN Entry
      {returnTo && <span data-testid="return-to">{returnTo}</span>}
    </div>
  );
}

function renderWithRouter(initialRoute = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<div data-testid="admin-content">Admin Page</div>} />
          <Route path="/admin/chores" element={<div data-testid="admin-content">Chores Page</div>} />
        </Route>
        <Route path="/admin/pin" element={<PinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminGuard', () => {
  it('shows loading state with aria-live region while checking session', () => {
    server.use(
      http.get('/api/auth/session', async () => {
        await delay('infinite');
        return HttpResponse.json({ data: { valid: true } });
      }),
    );

    renderWithRouter();

    const loading = screen.getByRole('status');
    expect(loading).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/checking session/i)).toBeInTheDocument();
  });

  it('renders child route when session is valid', async () => {
    server.use(
      http.get('/api/auth/session', () =>
        HttpResponse.json({ data: { valid: true } }),
      ),
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });

  it('redirects to /admin/pin when session is invalid', async () => {
    server.use(
      http.get('/api/auth/session', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        ),
      ),
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('pin-page')).toBeInTheDocument();
    });
    expect(screen.getByText('PIN Entry')).toBeInTheDocument();
  });

  it('redirects to /admin/pin on network error', async () => {
    server.use(
      http.get('/api/auth/session', () => HttpResponse.error()),
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('pin-page')).toBeInTheDocument();
    });
  });

  it('includes returnTo param when redirecting to PIN entry', async () => {
    server.use(
      http.get('/api/auth/session', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        ),
      ),
    );

    renderWithRouter('/admin/chores');

    await waitFor(() => {
      expect(screen.getByTestId('pin-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('return-to')).toHaveTextContent('/admin/chores');
  });
});
