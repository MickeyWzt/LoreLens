// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAppContextStore } from '../store/useAppContextStore';
import { useSettingsStore } from '../store/useSettingsStore';

vi.mock('../components/HomeView', () => ({
  HomeView: () => React.createElement('main', { 'data-testid': 'home-stub' }),
}));

import App from '../App';

const english = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), 'public/locales/en/translation.json'),
  'utf8',
));

describe('location bootstrap', () => {
  const testI18n = createInstance();

  beforeEach(async () => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    await testI18n.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: english } },
    });
    useSettingsStore.setState({ language: 'en', locationEnabled: true });
    useAppContextStore.setState({ location: undefined, locationStatus: 'idle' });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test('requests location when the app opens even if the home view has no location logic', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 31.2304,
          longitude: 121.4737,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    render(
      <I18nextProvider i18n={testI18n}>
        <App />
      </I18nextProvider>,
    );

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
  });
});
