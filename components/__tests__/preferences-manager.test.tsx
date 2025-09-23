import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
}));

import { PreferencesManager } from '@/components/settings/preferences-manager';
import { toast } from '@/components/toast';
import {
  createDefaultPreferences,
  serializeUserPreferences,
  type UserPreferences,
} from '@/lib/types/preferences';

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

describe('PreferencesManager', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    // @ts-expect-error - assigning test double
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('saves preferences via the settings API and emits success feedback', async () => {
    const preferences = createDefaultPreferences();
    const responsePreferences: UserPreferences = {
      ...preferences,
      lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(serializeUserPreferences(responsePreferences)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const onPreferencesSaved = vi.fn();

    render(
      <PreferencesManager
        currentPreferences={preferences}
        onPreferencesReset={vi.fn()}
        onPreferencesImport={vi.fn()}
        onPreferencesSaved={onPreferencesSaved}
        hasUnsavedChanges
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit?.method).toBe('PUT');

    const payload = JSON.parse(requestInit?.body as string);
    expect(payload).toMatchObject(serializeUserPreferences(preferences));

    await waitFor(() => expect(onPreferencesSaved).toHaveBeenCalledWith(responsePreferences));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    );
  });

  it('shows an error toast when the API request fails', async () => {
    const preferences = createDefaultPreferences();

    fetchMock.mockResolvedValue(
      new Response('Internal error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    render(
      <PreferencesManager
        currentPreferences={preferences}
        onPreferencesReset={vi.fn()}
        onPreferencesImport={vi.fn()}
        hasUnsavedChanges
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });
});
