import { describe, expect, test } from 'vitest';

async function loadSettings() {
  return import('../store/useSettingsStore').catch(() => null);
}

describe('settings migration', () => {
  test('moves the legacy audio preference into the LoreLens settings schema', async () => {
    const module = await loadSettings();
    expect(module).not.toBeNull();
    if (!module) return;

    const migrated = module.migrateSettingsState({ highResAudio: true, language: 'zh' });

    expect(module.SETTINGS_KEY).toBe('lorelens_settings_v2');
    expect(migrated).toMatchObject({ readAloudEnabled: true, language: 'zh' });
    expect(migrated).not.toHaveProperty('highResAudio');
  });

  test('enables location assistance by default for existing settings', async () => {
    const module = await loadSettings();
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.migrateSettingsState({ language: 'zh' })).toMatchObject({
      language: 'zh',
      locationEnabled: true,
    });
  });

  test('maps legacy accent colors onto full palettes', async () => {
    const module = await loadSettings();
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.migrateSettingsState({ accentColor: 'teal' })).toMatchObject({ accentColor: 'coast' });
    expect(module.migrateSettingsState({ accentColor: 'unknown' })).toMatchObject({ accentColor: 'archive' });
  });
});
