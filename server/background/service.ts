export interface BackgroundResult {
  imageUrl: string;
  downloadLocation: string;
  photographer: string;
  photographerUrl: string;
}

interface BackgroundServiceOptions {
  accessKey?: string;
  fetchImpl?: typeof fetch;
}

interface UnsplashSearchResponse {
  results?: Array<{
    urls?: { regular?: string };
    links?: { download_location?: string };
    user?: { name?: string; links?: { html?: string } };
  }>;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('en-US');

export function createBackgroundService({
  accessKey,
  fetchImpl = fetch,
}: BackgroundServiceOptions = {}) {
  const cache = new Map<string, Promise<BackgroundResult | null>>();

  async function search(query: string): Promise<BackgroundResult | null> {
    if (!accessKey) return null;
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('orientation', 'portrait');
    url.searchParams.set('per_page', '1');

    const response = await fetchImpl(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
    if (!response.ok) {
      throw Object.assign(new Error(`Unsplash request failed: ${response.status}`), {
        status: response.status,
      });
    }

    const payload = await response.json() as UnsplashSearchResponse;
    const photo = payload.results?.[0];
    const imageUrl = photo?.urls?.regular;
    const downloadLocation = photo?.links?.download_location;
    if (!imageUrl || !downloadLocation) return null;

    return {
      imageUrl,
      downloadLocation,
      photographer: photo.user?.name || 'Unsplash photographer',
      photographerUrl: photo.user?.links?.html || 'https://unsplash.com',
    };
  }

  return {
    getBackground(query: string, timeBucket: string): Promise<BackgroundResult | null> {
      if (!accessKey) return Promise.resolve(null);
      const key = `${normalize(query)}::${normalize(timeBucket)}`;
      const existing = cache.get(key);
      if (existing) return existing;

      const pending = search(`${query.trim()} ${timeBucket.trim()}`)
        .catch((error) => {
          cache.delete(key);
          throw error;
        });
      cache.set(key, pending);
      return pending;
    },

    async trackDownload(downloadLocation: string): Promise<void> {
      if (!accessKey) return;
      const url = new URL(downloadLocation);
      if (url.protocol !== 'https:' || url.hostname !== 'api.unsplash.com') {
        throw Object.assign(new Error('Invalid Unsplash download URL'), { status: 400 });
      }
      const response = await fetchImpl(url, {
        headers: { Authorization: `Client-ID ${accessKey}` },
      });
      if (!response.ok) {
        throw Object.assign(new Error(`Unsplash download tracking failed: ${response.status}`), {
          status: response.status,
        });
      }
    },
  };
}

export type BackgroundService = ReturnType<typeof createBackgroundService>;
