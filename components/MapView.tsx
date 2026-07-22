
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useTranslation } from 'react-i18next';
import { IconChevronDown } from './Icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { useAppContextStore } from '../store/useAppContextStore';

interface MapViewProps {
  onClose: () => void;
}

export const MapView: React.FC<MapViewProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { theme, language } = useSettingsStore();
  const { records } = useHistoryStore();
  const currentLocation = useAppContextStore((state) => state.location);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Filter items with location
    const locations = records.filter((record) => (
      record.status === 'complete'
      && record.result
      && record.location?.lat !== undefined
      && record.location.lng !== undefined
    ));
    const hasCurrentLocation = currentLocation?.lat !== undefined && currentLocation.lng !== undefined;
    const defaultCenter: [number, number] = hasCurrentLocation
      ? [currentLocation.lat!, currentLocation.lng!]
      : locations.length > 0
        ? [locations[0].location!.lat!, locations[0].location!.lng!]
        : [20, 0];

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: hasCurrentLocation || locations.length > 0 ? 12 : 2,
        zoomControl: false,
        attributionControl: true
    });

    // Dark/Light Tiles
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    
    L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    // Custom Icon with escaped/sanitized thumbnail parameter
    const escapeHtml = (unsafe: string) => {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const createIcon = (thumbnail?: string) => {
        if (thumbnail) {
             const escapedThumb = escapeHtml(thumbnail);
             return L.divIcon({
                className: 'custom-pin',
                html: `<div style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.5); background: #333;">
                         <img src="${escapedThumb}" style="width: 100%; height: 100%; object-fit: cover;" />
                       </div>
                       <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid white;"></div>`,
                iconSize: [48, 56],
                iconAnchor: [24, 56],
                popupAnchor: [0, -60]
            });
        }
        return L.divIcon({
            className: 'custom-pin',
            html: `<div style="width: 24px; height: 24px; border-radius: 50%; background: #4F46E5; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    };

    const markers = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true
    });

    // Add Markers safely
    locations.forEach(item => {
        if (item.location?.lat !== undefined && item.location.lng !== undefined && item.result) {
            const marker = L.marker([item.location.lat, item.location.lng], {
                icon: createIcon(item.thumbnail)
            });

            const titleEscaped = escapeHtml(item.result.title);
            const essenceEscaped = escapeHtml(item.result.essence);
            const mapUriEscaped = item.result.mapUri ? escapeHtml(item.result.mapUri) : '';
            const isSafeUri = !mapUriEscaped || mapUriEscaped.startsWith('http://') || mapUriEscaped.startsWith('https://');

            const popupContent = `
                <div class="text-sm font-sans w-48 ${isDark ? 'text-white' : 'text-gray-900'}">
                    <h3 class="font-bold text-base mb-1 truncate">${titleEscaped}</h3>
                    <p class="text-gray-500 line-clamp-2 text-xs leading-relaxed mb-2">${essenceEscaped}</p>
                    ${isSafeUri && mapUriEscaped ? `<a href="${mapUriEscaped}" target="_blank" class="text-blue-500 hover:text-blue-600 font-medium no-underline inline-block">${t('map.openMaps')}</a>` : ''}
                </div>
            `;
            marker.bindPopup(popupContent);
            markers.addLayer(marker);
        }
    });
    
    map.addLayer(markers);

    if (hasCurrentLocation) {
      L.circleMarker([currentLocation.lat!, currentLocation.lng!], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#6366f1',
        fillOpacity: 1,
      }).addTo(map).bindTooltip(t('map.currentLocation'));
    }

    // Fit bounds if multiple locations
    if (locations.length > 1) {
        map.fitBounds(markers.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }

    mapInstanceRef.current = map;

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, [currentLocation, language, records, theme, t]);

  const hasMapData = records.some((record) => (
    record.location?.lat !== undefined && record.location.lng !== undefined
  )) || (currentLocation?.lat !== undefined && currentLocation.lng !== undefined);

  return (
    <div role="region" aria-label={t('map.title')} className="absolute inset-0 z-30 flex flex-col bg-[#0b0b0a]">
        {/* Header - Z-index increased to 2000 to sit above Leaflet controls */}
        <div className={`ll-material absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[2000] flex items-center justify-between rounded-2xl px-4 py-3 ${isDark ? '' : '!border-black/10 !bg-[#f2efe6]/88'}`}>
            <h1 className={`font-serif text-2xl tracking-[-0.03em] ${isDark ? 'text-[#f4f0e6]' : 'text-[#171714]'}`}>{t('map.title')}</h1>
            <button 
                aria-label={t('aria.close')}
                onClick={onClose} 
                className={`ll-pressable flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-150 ${isDark ? 'border-white/12 bg-white/7 text-white' : 'border-black/10 bg-black/5 text-[#171714]'}`}
            >
                <IconChevronDown className="w-6 h-6" />
            </button>
        </div>
        
        <div ref={mapContainerRef} className="w-full h-full" />
        {!hasMapData && (
          <div className="ll-material pointer-events-none absolute inset-x-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[1000] rounded-2xl p-4 text-center text-sm font-medium text-white">
            {t('map.empty')}
          </div>
        )}
    </div>
  );
};
