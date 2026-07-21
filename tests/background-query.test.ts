import { describe, expect, test, vi } from 'vitest';
import { backgroundQueriesForLocation, getBackground } from '../services/backgroundService';

describe('background location query', () => {
  test('orders searches from the precise address down to broader regions', () => {
    expect(backgroundQueriesForLocation('Yuzhi East Road, Changping District, Beijing, China'))
      .toEqual([
        'Yuzhi East Road Changping District Beijing China travel cityscape',
        'Changping District Beijing China travel cityscape',
        'Beijing China travel cityscape',
        'China travel cityscape',
        'world travel cityscape',
      ]);
    expect(backgroundQueriesForLocation('育知东路，昌平区，北京，中国'))
      .toEqual([
        '育知东路 昌平区 北京 中国 travel cityscape',
        '昌平区 北京 中国 travel cityscape',
        '北京 中国 travel cityscape',
        '中国 travel cityscape',
        'world travel cityscape',
      ]);
  });

  test('keeps a recognizable city together with its country', () => {
    expect(backgroundQueriesForLocation('Paris, Île-de-France, France')[0])
      .toBe('Paris Île-de-France France travel cityscape');
    expect(backgroundQueriesForLocation('New York, NY, USA')[0])
      .toBe('New York NY USA travel cityscape');
  });

  test('uses a global travel query when no label is available', () => {
    expect(backgroundQueriesForLocation()).toEqual(['world travel cityscape']);
  });

  test('requests broader levels only until Unsplash returns an image', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ status: 204, ok: true })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ data: {
          imageUrl: 'https://images.unsplash.com/changping.jpg',
          downloadLocation: 'https://api.unsplash.com/photos/changping/download',
          photographer: 'Photo',
          photographerUrl: 'https://unsplash.com/@photo',
        } }),
      });

    const result = await getBackground(['street level', 'Changping Beijing'], 'night', fetchImpl as typeof fetch);

    expect(result?.imageUrl).toContain('changping.jpg');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('query=street+level');
    expect(String(fetchImpl.mock.calls[1][0])).toContain('query=Changping+Beijing');
  });
});
