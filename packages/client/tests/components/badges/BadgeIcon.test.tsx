import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test-utils.js';
import BadgeIcon from '../../../src/components/badges/BadgeIcon.js';

describe('BadgeIcon', () => {
  it('renders earned badge with full-color styling', () => {
    renderWithProviders(<BadgeIcon badgeKey="first_step" isEarned />);

    const badge = screen.getByRole('img', { name: /first step.*earned/i });
    expect(badge).toBeInTheDocument();
    expect(badge.className).not.toContain('grayscale');
    expect(badge.className).not.toContain('opacity-40');
  });

  it('renders locked badge with grayscale styling', () => {
    renderWithProviders(<BadgeIcon badgeKey="first_step" isEarned={false} />);

    const badge = screen.getByRole('img', { name: /first step.*locked/i });
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('grayscale');
    expect(badge.className).toContain('opacity-40');
  });

  it('displays correct label for known badge', () => {
    renderWithProviders(<BadgeIcon badgeKey="on_a_roll" isEarned />);

    expect(screen.getByText('On a Roll')).toBeInTheDocument();
  });

  it('falls back to badge key for unknown badge', () => {
    renderWithProviders(<BadgeIcon badgeKey="unknown_badge" isEarned />);

    expect(screen.getByText('unknown_badge')).toBeInTheDocument();
  });
});
