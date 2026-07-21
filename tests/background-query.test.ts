import { describe, expect, test } from 'vitest';
import { backgroundQueryForLocation } from '../services/backgroundService';

describe('background location query', () => {
  test('drops street and district detail that produces empty image searches', () => {
    expect(backgroundQueryForLocation('Yuzhi East Road, Changping District, China'))
      .toBe('China travel cityscape');
    expect(backgroundQueryForLocation('育知东路，昌平区，中国'))
      .toBe('中国 travel cityscape');
  });

  test('keeps a recognizable city together with its country', () => {
    expect(backgroundQueryForLocation('Paris, Île-de-France, France'))
      .toBe('Paris France travel cityscape');
    expect(backgroundQueryForLocation('New York, NY, USA'))
      .toBe('New York USA travel cityscape');
  });

  test('uses a global travel query when no label is available', () => {
    expect(backgroundQueryForLocation()).toBe('world travel cityscape');
  });
});
