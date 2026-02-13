import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import React from 'react';

// Mock next/navigation
const mockGet = vi.fn();
const mockSearchParams = { get: mockGet };
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock dependencies
vi.mock('@/lib/api', () => ({
  api: {
    getSubscription: vi.fn().mockResolvedValue({
      id: '1',
      plan: 'free',
      status: 'active',
      cancelAtPeriodEnd: false,
    }),
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test User',
      tier: 'free',
      preferences: { emailFrequency: 'daily' },
      createdAt: new Date().toISOString(),
    }),
    updatePreferences: vi.fn().mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test User',
      tier: 'free',
      preferences: { emailFrequency: 'never' },
      createdAt: new Date().toISOString(),
    }),
  },
}));

vi.mock('@/components/ProtectedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/icons', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

const mockEffectiveTier = { value: 'free' };
vi.mock('@/components/AdminProvider', () => ({
  useAdmin: () => ({ effectiveTier: mockEffectiveTier.value }),
}));

vi.mock('@/lib/billing', () => ({
  createCheckoutSession: vi.fn(),
  openBillingPortal: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackUpgradeClicked: vi.fn(),
}));

// Import after mocks
import AccountPage from '../../app/account/page';
import { api } from '@/lib/api';

describe('Account Page - Checkout Success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEffectiveTier.value = 'free';
    mockGet.mockReturnValue(null);
    // Mock window.history.replaceState
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  it('shows success banner when session_id is in URL', async () => {
    mockGet.mockReturnValue('cs_test_123');

    await act(async () => {
      render(<AccountPage />);
    });

    // Wait for effects
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText(/Welcome to/)).toBeInTheDocument();
    expect(screen.getByText(/Your subscription is active/)).toBeInTheDocument();
  });

  it('does not show banner when no session_id', async () => {
    mockGet.mockReturnValue(null);

    await act(async () => {
      render(<AccountPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.queryByText(/Welcome to/)).not.toBeInTheDocument();
  });

  it('dismisses banner when close button clicked', async () => {
    mockGet.mockReturnValue('cs_test_123');

    await act(async () => {
      render(<AccountPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const dismissBtn = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Welcome to/)).not.toBeInTheDocument();
  });

  it('polls subscription API when session_id present', async () => {
    mockGet.mockReturnValue('cs_test_123');
    vi.useFakeTimers();

    await act(async () => {
      render(<AccountPage />);
    });

    // Advance timer to trigger poll
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // getSubscription should be called: once on mount + at least once from polling
    expect(api.getSubscription).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('shows Builder label for pro current plan', async () => {
    mockEffectiveTier.value = 'pro';

    await act(async () => {
      render(<AccountPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const currentPlanSection = screen
      .getByRole('heading', { name: 'Current Plan' })
      .closest('section');

    expect(currentPlanSection).not.toBeNull();
    expect(within(currentPlanSection as HTMLElement).getByText('Builder')).toBeInTheDocument();
    expect(within(currentPlanSection as HTMLElement).queryByText(/^pro$/i)).not.toBeInTheDocument();
  });

  it('updates email preference when unsubscribe button is clicked', async () => {
    await act(async () => {
      render(<AccountPage />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const button = screen.getByRole('button', { name: 'Unsubscribe from Emails' });
    fireEvent.click(button);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(api.updatePreferences).toHaveBeenCalledWith({ emailFrequency: 'never' });
  });
});
