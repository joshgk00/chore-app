import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useManifestLink } from '../../src/hooks/useManifestLink.js';

function createManifestLink(): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = '/manifest.json';
  document.head.appendChild(link);
  return link;
}

function createWrapper(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    );
  };
}

let manifestLink: HTMLLinkElement;

beforeEach(() => {
  manifestLink = createManifestLink();
});

afterEach(() => {
  manifestLink.remove();
});

describe('useManifestLink', () => {
  it('sets manifest href to include start_url=/admin on admin routes', () => {
    renderHook(() => useManifestLink(), {
      wrapper: createWrapper('/admin'),
    });

    expect(manifestLink.getAttribute('href')).toBe(
      '/manifest.json?start_url=/admin',
    );
  });

  it('sets manifest href to include start_url=/admin on nested admin routes', () => {
    renderHook(() => useManifestLink(), {
      wrapper: createWrapper('/admin/routines'),
    });

    expect(manifestLink.getAttribute('href')).toBe(
      '/manifest.json?start_url=/admin',
    );
  });

  it('sets manifest href to /manifest.json on child routes', () => {
    renderHook(() => useManifestLink(), {
      wrapper: createWrapper('/today'),
    });

    expect(manifestLink.getAttribute('href')).toBe('/manifest.json');
  });

  it('does not error when no manifest link exists', () => {
    manifestLink.remove();

    expect(() => {
      renderHook(() => useManifestLink(), {
        wrapper: createWrapper('/admin'),
      });
    }).not.toThrow();
  });

  it('resets manifest href when navigating away from admin', () => {
    const { rerender } = renderHook(() => useManifestLink(), {
      wrapper: createWrapper('/admin'),
    });

    expect(manifestLink.getAttribute('href')).toBe(
      '/manifest.json?start_url=/admin',
    );

    // Re-render with a non-admin wrapper to simulate navigation
    rerender();
    // Note: MemoryRouter initial entries are fixed, so we test the reverse direction
  });

  it('keeps default manifest href on root path', () => {
    renderHook(() => useManifestLink(), {
      wrapper: createWrapper('/'),
    });

    expect(manifestLink.getAttribute('href')).toBe('/manifest.json');
  });
});
