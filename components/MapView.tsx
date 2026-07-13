
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useTranslation } from 'react-i18next';
import { HistoryItem } from '../types';
import { IconChevronDown } from './Icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHistoryStore } from '../store/useHistoryStore';

interface MapViewProps {
  onClose: () => void;
}

export const MapView: React.FC<MapViewProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { theme, language } = useSettingsStore();
  const { history } = useHistoryStore();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Filter items with location
    const locations = history.filter(item => item.location);
    const defaultCenter: [number, number] = locations.length > 0 
        ? [locations[0].location!.lat, locations[0].location!.lng] 
        : [39.9042, 116.4074]; // Default to Beijing

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false
    });

    // Dark/Light Tiles
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    
    L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
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
        if (item.location) {
            const marker = L.marker([item.location.lat, item.location.lng], {
                icon: createIcon(item.thumbnail)
            });

            const titleEscaped = escapeHtml(item.title);
            const essenceEscaped = escapeHtml(item.essence);
            const mapUriEscaped = item.mapUri ? escapeHtml(item.mapUri) : '';
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
  }, [theme, language]); // Re-init if theme or language changes

  return (
    <div className="absolute inset-0 z-30 bg-black animate-fade-in flex flex-col">
        {/* Header - Z-index increased to 2000 to sit above Leaflet controls */}
        <div className={`pt-12 px-6 pb-4 flex items-center justify-between z-[2000] ${isDark ? 'bg-black/60' : 'bg-white/80'} backdrop-blur-md absolute top-0 inset-x-0`}>
            <h1 className={`text-2xl font-light tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('map.title')}</h1>
            <button 
                onClick={onClose} 
                className={`p-2 rounded-full ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-gray-900'}`}
            >
                <IconChevronDown className="w-6 h-6" />
            </button>
        </div>
        
        <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
