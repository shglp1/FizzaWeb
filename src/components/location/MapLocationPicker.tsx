'use client';
/**
 * MapLocationPicker — search + interactive map pin refinement (Task 11.1).
 *
 * User flow:
 *  1. Type to search → autocomplete suggestions appear (same /api/maps/geocode as LocationPicker).
 *  2. Select suggestion → map appears centred on that coordinate with a draggable marker.
 *  3. Drag marker or click map to refine exact pin position.
 *  4. "Confirm location" button stores the final lat/lng.
 *  5. Confirmed card shows coordinates + "Open in Google Maps" link.
 *
 * SSR safety: Leaflet is loaded inside useEffect (client-only). The map container
 * renders only after mount, so no hydration mismatch occurs.
 *
 * Leaflet CSS is injected once via a <link> element; subsequent mounts reuse it.
 */

import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { buildGoogleMapsPlaceUrl } from '@/lib/maps/googleMapsLink';
import { mapGeoErrorMessage } from '@/lib/ui/mapLocation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectedLocation {
  label: string;
  latitude: number;
  longitude: number;
  provider: string;
  providerPlaceId?: string;
}

interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  provider: string;
  providerPlaceId?: string;
}

export interface MapLocationPickerProps {
  label: string;
  value: SelectedLocation | null;
  onChange: (loc: SelectedLocation | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Search language for geocoding — Arabic and English supported */
  searchLang?: 'ar' | 'en';
  photoUrl?: string | null;
  onPhotoChange?: (url: string | null) => void;
  photoKind?: 'pickup' | 'dropoff';
}

// ─── Leaflet CSS injector (idempotent) ────────────────────────────────────────

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function ensureLeafletCss(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PinIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

// ─── Map panel (mounted client-side) ─────────────────────────────────────────

interface MapPanelProps {
  initialLat: number;
  initialLng: number;
  initialLabel: string;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

function markerHtml(color: string, size = 28): string {
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);"></div>`;
}

function MapPanel({ initialLat, initialLng, initialLabel, onConfirm, onCancel }: MapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const [pinLat, setPinLat] = useState(initialLat);
  const [pinLng, setPinLng] = useState(initialLng);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    ensureLeafletCss();
  }, []);

  useEffect(() => {
    if (!mounted || !mapRef.current) return;
    // Dynamically import Leaflet to avoid SSR
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current!, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        html: markerHtml('#059669', 32),
        className: 'fizza-map-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([initialLat, initialLng], { draggable: true, icon }).addTo(map);
      marker.bindPopup('Drag me to refine the pickup location', { maxWidth: 200 }).openPopup();

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setPinLat(pos.lat);
        setPinLng(pos.lng);
      });

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setPinLat(e.latlng.lat);
        setPinLng(e.latlng.lng);
      });

      leafletRef.current = map;
      markerRef.current = marker;

      // Invalidate size after a tick (fixes map rendering in hidden/animated containers)
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 overflow-hidden bg-white">
      {/* Map container */}
      <div ref={mapRef} className="w-full" style={{ height: 260 }} />

      {/* Coordinate readout + controls */}
      <div className="p-3 bg-emerald-50 border-t border-emerald-100">
        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <span className="text-emerald-600"><PinIcon /></span>
          <span className="font-medium text-gray-700 truncate">{initialLabel}</span>
        </p>
        <p className="text-xs font-mono text-gray-500 mb-3">
          {pinLat.toFixed(6)}, {pinLng.toFixed(6)}
        </p>
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <MapIcon />
          Drag the marker or click the map to refine the exact position.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(pinLat, pinLng)}
            className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Confirm location
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapLocationPicker({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  searchLang = 'en',
  photoUrl,
  onPhotoChange,
  photoKind = 'pickup',
}: MapLocationPickerProps) {
  const inputId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Staging area: user selected a suggestion but hasn't confirmed pin yet
  const [staging, setStaging] = useState<GeocodeResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');

  const [searchLangState, setSearchLangState] = useState<'ar' | 'en'>(searchLang);
  const [photoUploading, setPhotoUploading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]); setShowDropdown(false); setActiveIndex(-1); return;
    }
    setSearching(true); setSearchError('');
    try {
      const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(q.trim())}&lang=${searchLangState}`);
      const json = await res.json() as { data?: GeocodeResult[]; error?: { message: string } };
      if (json.data) {
        setSuggestions(json.data); setShowDropdown(true); setActiveIndex(-1);
      } else {
        setSearchError(res.status >= 500 ? 'Location service temporarily unavailable.' : (json.error?.message ?? 'Search failed.'));
        setSuggestions([]); setShowDropdown(false);
      }
    } catch {
      setSearchError('Could not reach the location service. Check your connection.');
      setSuggestions([]); setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  }, [searchLangState]);

  const uploadPhoto = async (file: File) => {
    if (!onPhotoChange) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', photoKind);
      const res = await fetch('/api/subscriptions/location-photo', { method: 'POST', body: fd });
      const json = await res.json() as { data?: { url: string }; error?: { message: string } };
      if (json.data?.url) onPhotoChange(json.data.url);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q); setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(q), 350);
  };

  const handleSelect = (loc: GeocodeResult) => {
    // Move to map-refinement stage instead of confirming immediately
    setStaging(loc);
    setQuery(''); setSuggestions([]); setShowDropdown(false); setActiveIndex(-1);
  };

  const handleConfirmPin = (lat: number, lng: number) => {
    if (!staging) return;
    onChange({ ...staging, latitude: lat, longitude: lng });
    setStaging(null);
  };

  const handleCancelStaging = () => {
    setStaging(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = () => {
    onChange(null); setStaging(null);
    setQuery(''); setSuggestions([]); setShowDropdown(false); setSearchError('');
    setGeoMessage('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleUseCurrentLocation = () => {
    if (disabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMessage('Location is not supported on this device. Please search manually.');
      return;
    }
    setLocating(true);
    setGeoMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setStaging({
          label: 'My current location',
          latitude,
          longitude,
          provider: 'device',
        });
        setGeoMessage('Using your current location — move the pin if needed.');
        setLocating(false);
        setQuery('');
        setSuggestions([]);
        setShowDropdown(false);
      },
      (err) => {
        setLocating(false);
        setGeoMessage(mapGeoErrorMessage(err.code));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); const loc = suggestions[activeIndex]; if (loc) handleSelect(loc); }
    else if (e.key === 'Escape') { setShowDropdown(false); setActiveIndex(-1); }
  };

  // ── Confirmed state ──
  if (value) {
    const mapsUrl = buildGoogleMapsPlaceUrl(value.latitude, value.longitude, value.label);
    return (
      <div className={`space-y-1 ${className}`}>
        <p className="text-sm font-medium text-gray-700">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </p>
        <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-emerald-600"><PinIcon /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-gray-800 break-words">{value.label}</p>
              <p className="mt-1 text-xs font-medium text-emerald-700">Exact pin selected</p>
              <p className="mt-0.5 text-xs text-gray-400 font-mono">
                {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
              </p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                <MapIcon />
                Open in Google Maps
              </a>
            </div>
            {!disabled && onPhotoChange && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60">
                <p className="text-xs text-gray-600 mb-2">
                  Optional: add a photo of the {photoKind} point to help the driver identify the exact location.
                </p>
                {photoUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                    <button type="button" onClick={() => onPhotoChange(null)} className="text-xs text-red-600 hover:underline">Remove photo</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={photoUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ''; }} />
                    {photoUploading ? 'Uploading…' : 'Add location photo'}
                  </label>
                )}
              </div>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                aria-label={`Clear ${label}`}
              >
                <XIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Search + optional map-refinement ──
  return (
    <div ref={wrapperRef} className={`space-y-1 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700 flex flex-wrap items-center justify-between gap-2">
        <span>{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>
        <span className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          <button type="button" className={`px-2.5 py-1 ${searchLangState === 'en' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`} onClick={() => setSearchLangState('en')}>EN</button>
          <button type="button" className={`px-2.5 py-1 ${searchLangState === 'ar' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`} onClick={() => setSearchLangState('ar')}>AR</button>
        </span>
      </label>

      {/* Search input — hidden when staging (map visible) */}
      {!staging && (
        <>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={disabled || locating}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? <Spinner /> : <PinIcon />}
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
      {geoMessage && !staging && (
        <p className="mb-2 text-xs text-emerald-700" role="status">{geoMessage}</p>
      )}

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              {searching ? <Spinner /> : <SearchIcon />}
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
              placeholder={placeholder ?? 'Type an address, district, or landmark…'}
              disabled={disabled}
              autoComplete="off"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `mloc-opt-${activeIndex}` : undefined}
              className={[
                'w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors',
                'focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200',
                disabled ? 'cursor-not-allowed bg-gray-50 opacity-60' : '',
              ].filter(Boolean).join(' ')}
            />
          </div>

          {searchError && (
            <p className="text-xs text-red-600" role="alert">{searchError}</p>
          )}

          {showDropdown && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`${label} suggestions`}
              className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
            >
              {suggestions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-400 italic">No locations found.</li>
              ) : (
                suggestions.map((s, i) => (
                  <li key={`${s.label}-${i}`} id={`mloc-opt-${i}`} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                      className={[
                        'flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm transition-colors',
                        i === activeIndex ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50',
                        i < suggestions.length - 1 ? 'border-b border-gray-100' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="mt-0.5 shrink-0 text-gray-400"><PinIcon /></span>
                      <div className="min-w-0 flex-1">
                        <p className="leading-snug break-words">{s.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)} · Tap to place pin on map
                        </p>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {!query && !searchError && (
            <p className="text-xs text-gray-400">
              Type at least 3 characters to search. You can drag the pin to refine after selecting.
            </p>
          )}
        </>
      )}

      {/* Map refinement panel — shown after suggestion selected, before confirm */}
      {staging && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
            <MapIcon />
            <span>
              <span className="font-semibold">Refine pin:</span> Drag the marker or click the map for the exact location.
            </span>
          </div>
          <MapPanel
            initialLat={staging.latitude}
            initialLng={staging.longitude}
            initialLabel={staging.label}
            onConfirm={handleConfirmPin}
            onCancel={handleCancelStaging}
          />
        </div>
      )}
    </div>
  );
}
