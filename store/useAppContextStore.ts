import { create } from 'zustand';
import type { LocationSnapshot } from '../types';
import { getBackground, type ClientBackground } from '../services/backgroundService';
import { addLocationLabel, resolveLocation } from '../services/locationService';

interface AppContextState {
  location?: LocationSnapshot;
  locationStatus: 'idle' | 'loading' | 'ready';
  background?: ClientBackground | null;
  backgroundKey?: string;
  ensureLocation: (language: string) => Promise<LocationSnapshot>;
  ensureBackground: (query: string, timeBucket: string) => Promise<ClientBackground | null>;
}

let pendingLocation: Promise<LocationSnapshot> | undefined;

export const useAppContextStore = create<AppContextState>((set, get) => ({
  locationStatus: 'idle',
  ensureLocation: async (language) => {
    if (get().location) return get().location!;
    if (pendingLocation) return pendingLocation;
    set({ locationStatus: 'loading' });
    pendingLocation = resolveLocation()
      .then((location) => addLocationLabel(location, language))
      .then((location) => {
        set({ location, locationStatus: 'ready' });
        return location;
      })
      .finally(() => { pendingLocation = undefined; });
    return pendingLocation;
  },
  ensureBackground: async (query, timeBucket) => {
    const key = `${query.trim().toLowerCase()}::${timeBucket}`;
    if (get().backgroundKey === key) return get().background ?? null;
    const background = await getBackground(query, timeBucket);
    set({ background, backgroundKey: key });
    return background;
  },
}));
