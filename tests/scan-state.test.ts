import { describe, expect, test } from 'vitest';

async function loadScanState() {
  return import('../domain/scanState').catch(() => null);
}

describe('scan state machine', () => {
  test('follows the capture to result flow without contradictory flags', async () => {
    const scan = await loadScanState();
    expect(scan).not.toBeNull();
    if (!scan) return;

    let state = scan.initialScanState;
    state = scan.scanReducer(state, { type: 'OPEN_CAMERA' });
    state = scan.scanReducer(state, { type: 'CAPTURE', image: 'data:image/jpeg;base64,a' });
    state = scan.scanReducer(state, { type: 'START_ANALYSIS', image: 'data:image/jpeg;base64,b' });
    state = scan.scanReducer(state, {
      type: 'ANALYSIS_SUCCESS',
      result: {
        title: 'Object',
        essence: 'Essence',
        mirrorInsight: 'Mirror',
        philosophy: 'Philosophy',
        quickAction: 'Action',
      },
    });

    expect(state.stage).toBe('result');
    expect(state.image).toContain('base64,b');
    expect(state.error).toBeUndefined();
  });

  test('moves an offline analysis into an explicit pending state', async () => {
    const scan = await loadScanState();
    expect(scan).not.toBeNull();
    if (!scan) return;

    const state = scan.scanReducer(
      { ...scan.initialScanState, stage: 'analyzing', image: 'offline-image' },
      { type: 'QUEUE_OFFLINE' },
    );

    expect(state.stage).toBe('pending');
    expect(state.image).toBe('offline-image');
  });
});
