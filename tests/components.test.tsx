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
import { HistoryView } from '../components/HistoryView';
import { SettingsView } from '../components/SettingsView';
import { ResultDrawer, shouldDismissResultDrawer } from '../components/ResultDrawer';
import { useHistoryStore } from '../store/useHistoryStore';
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
    useSettingsStore.setState({ language: 'en', readAloudEnabled: false, theme: 'dark', accentColor: 'archive' });
    useHistoryStore.setState({ history: [], records: [] });
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

  test('read aloud preference keeps provider details out of the interface', () => {
    renderLocalized(<SettingsView onBack={() => undefined} />);
    const readAloud = screen.getByRole('switch', { name: /enable read aloud/i });

    expect(readAloud).toHaveTextContent('Read results aloud with a natural voice.');
    expect(readAloud).not.toHaveTextContent(/Xiaomi|Qwen/i);
  });

  test('settings expose a concise, collapsed privacy notice', () => {
    renderLocalized(<SettingsView onBack={() => undefined} />);

    const summary = screen.getByText('Privacy');
    const notice = summary.closest('details');
    expect(notice).not.toHaveAttribute('open');
    expect(notice).toHaveTextContent('Photos are sent only when you choose Analyze.');
    expect(notice).toHaveTextContent('History stays on this device unless you export it.');
  });

  test('location assistance is enabled by default and can be disabled', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ locationEnabled: true });
    renderLocalized(<SettingsView onBack={() => undefined} />);

    const location = screen.getByRole('switch', { name: /use location for identification/i });
    expect(location).toHaveAttribute('aria-checked', 'true');
    await user.click(location);
    expect(location).toHaveAttribute('aria-checked', 'false');
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

  test('a virtual-only camera list explains that no physical camera is available', async () => {
    const stop = vi.fn();
    const track = {
      getSettings: () => ({ deviceId: 'obs' }),
      stop,
    } as unknown as MediaStreamTrack;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        }),
        enumerateDevices: vi.fn().mockResolvedValue([{
          deviceId: 'obs',
          groupId: 'virtual',
          kind: 'videoinput',
          label: 'OBS Virtual Camera',
          toJSON: () => ({}),
        }]),
      },
    });
    const user = userEvent.setup();
    renderLocalized(<App />);
    await user.click(await screen.findByRole('button', { name: /scan to decipher/i }));

    await waitFor(() => expect(screen.getAllByText('No physical camera was found').length).toBeGreaterThan(0));
    expect(screen.getByText(/privacy shutter/i)).toBeInTheDocument();
    expect(stop).toHaveBeenCalledOnce();
  });

  test('home keeps the product mark out of the main content', () => {
    renderLocalized(<App />);

    expect(screen.queryByRole('heading', { name: 'LoreLens' })).not.toBeInTheDocument();
    expect(screen.getByText(english.home.subtitle)).toBeInTheDocument();
  });

  test('navigation releases focus before hiding the camera layer', async () => {
    const user = userEvent.setup();
    renderLocalized(<App />);
    const historyButton = screen.getByRole('button', { name: english.history.title });
    historyButton.focus();

    await user.click(historyButton);

    expect(await screen.findByRole('region', { name: english.history.title })).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  test('palette previews switch the complete color story', async () => {
    const user = userEvent.setup();
    renderLocalized(<SettingsView onBack={() => undefined} />);

    const sunset = screen.getByRole('button', { name: 'Ocean sunset' });
    expect(sunset).toHaveAttribute('aria-pressed', 'false');
    await user.click(sunset);

    expect(useSettingsStore.getState().accentColor).toBe('sunset');
    expect(sunset).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(5);
  });

  test('history actions stack below the title on mobile and use the compact Review label', async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      history: [{
        id: 'mobile-layout-record',
        timestamp: Date.now(),
        title: 'Neon Lime K-Mouse',
        essence: 'A vivid object',
        mirrorInsight: 'Notice color',
        philosophy: 'Attention reveals character',
        quickAction: 'Look again',
      }],
      records: [],
    });

    renderLocalized(<HistoryView onSelect={() => undefined} onClose={() => undefined} />);

    const heading = screen.getByRole('heading', { name: english.history.title });
    expect(heading.parentElement?.parentElement).toHaveClass('flex-col', 'sm:flex-row');

    const review = screen.getByRole('button', { name: 'Review' });
    expect(review).toHaveClass('flex-1', 'sm:flex-none');
    expect(review.parentElement).toHaveClass('w-full', 'sm:w-auto');

    await user.click(screen.getByRole('button', { name: english.history.manage }));
    expect(screen.getByRole('button', { name: english.history.selectAll })).toHaveClass('flex-1', 'sm:flex-none');
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

  test('result drawer dismissal follows downward distance and momentum', () => {
    expect(shouldDismissResultDrawer({ offsetY: 150, velocityY: 0, drawerHeight: 700 })).toBe(true);
    expect(shouldDismissResultDrawer({ offsetY: 48, velocityY: 1200, drawerHeight: 700 })).toBe(true);
    expect(shouldDismissResultDrawer({ offsetY: 48, velocityY: -1200, drawerHeight: 700 })).toBe(false);
  });

  test('an open result drawer exposes a dedicated direct-manipulation handle', () => {
    const { container } = renderLocalized(<ResultDrawer
      isOpen
      onClose={() => undefined}
      result={{
        title: 'Gate',
        essence: 'Threshold',
        mirrorInsight: 'Pause',
        philosophy: 'Attention matters',
        quickAction: 'Look again',
      }}
    />);

    expect(screen.getByRole('dialog', { name: 'Gate' })).toBeInTheDocument();
    expect(container.querySelector('[data-result-drawer-handle]')).toBeInTheDocument();
  });
});
