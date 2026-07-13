// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import '@testing-library/jest-dom/vitest';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { syncDocumentLanguage } from '../i18n';
import App from '../App';
import { SettingsView } from '../components/SettingsView';
import { ResultDrawer } from '../components/ResultDrawer';
import { useSettingsStore } from '../store/useSettingsStore';

const english = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), 'public/locales/en/translation.json'),
  'utf8',
));

describe('accessible app states', () => {
  const testI18n = createInstance();

  beforeEach(async () => {
    cleanup();
    localStorage.clear();
    await testI18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: english } } });
    useSettingsStore.setState({ language: 'en', readAloudEnabled: false });
  });

  const renderLocalized = (element: ReactElement) => render(
    <I18nextProvider i18n={testI18n}>{element}</I18nextProvider>,
  );

  test('settings preferences are real keyboard-operable switches', async () => {
    const user = userEvent.setup();
    renderLocalized(<SettingsView onBack={() => undefined} />);
    const readAloud = screen.getByRole('switch', { name: /enable read aloud/i });

    expect(readAloud).toHaveAttribute('aria-checked', 'false');
    await user.click(readAloud);
    expect(readAloud).toHaveAttribute('aria-checked', 'true');
  });

  test('font-size controls have distinct accessible names', () => {
    renderLocalized(<SettingsView onBack={() => undefined} />);

    expect(screen.getByRole('button', { name: /small text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /medium text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /large text/i })).toBeInTheDocument();
  });

  test('a denied camera offers photo selection instead of a generic failure', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
    });
    const user = userEvent.setup();
    renderLocalized(<App />);
    await user.click(await screen.findByRole('button', { name: /scan to decipher/i }));

    await waitFor(() => expect(screen.getAllByText('Camera permission was denied').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: /choose photo/i }).length).toBeGreaterThan(0);
  });

  test('Arabic switches the document into RTL mode', () => {
    syncDocumentLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  test('a closed result drawer is removed from the accessibility tree', () => {
    renderLocalized(<ResultDrawer
      isOpen={false}
      onClose={() => undefined}
      result={{
        title: 'Gate',
        essence: 'Threshold',
        mirrorInsight: 'Pause',
        philosophy: 'Attention matters',
        quickAction: 'Look again',
      }}
    />);

    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });
});
