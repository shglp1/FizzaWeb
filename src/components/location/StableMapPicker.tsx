'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, Navigation, Search, X } from 'lucide-react';
import { buildGoogleMapsPlaceUrl } from '@/lib/maps/googleMapsLink';
import { mapGeoErrorMessage } from '@/lib/ui/mapLocation';
import {
  DEFAULT_MAP_CENTER,
  mapPickerCopy,
  mapPickerMarkerColor,
  mapPickerSectionTitle,
  sanitizeManualLabel,
  type GeocodeSuggestion,
  type MapPickerLanguage,
  type MapPickerMode,
  type StableMapLocationValue,
} from '@/lib/location/stableMapPickerHelpers';

const StableMapInnerMap = dynamic(() => import('./StableMapInnerMap'), { ssr: false });

export type { StableMapLocationValue };

export type StableMapPickerProps = {
  mode: MapPickerMode;
  value?: StableMapLocationValue | null;
  language: MapPickerLanguage;
  expanded: boolean;
  onExpand: () => void;
  onConfirm: (value: StableMapLocationValue) => void;
  onCancel?: () => void;
  allowPhoto?: boolean;
  disabled?: boolean;
};

type DraftState = {
  label: string;
  lat: number;
  lng: number;
  fromDevice: boolean;
  photoUrl?: string | null;
};

export function StableMapPicker({
  mode,
  value,
  language,
  expanded,
  onExpand,
  onConfirm,
  onCancel,
  allowPhoto = false,
  disabled = false,
}: StableMapPickerProps) {
  const copy = mapPickerCopy(language);
  const inputId = useId();
  const listId = useId();
  const isRtl = language === 'ar';

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) {
      setDraft(null);
      setQuery('');
      setSuggestions([]);
      setShowResults(false);
      setSearchError('');
      setGeoMessage('');
      setEditingLabel(false);
    }
  }, [expanded]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 3) {
        setSuggestions([]);
        setShowResults(false);
        return;
      }
      setSearching(true);
      setSearchError('');
      try {
        const res = await fetch(
          `/api/maps/geocode?q=${encodeURIComponent(q.trim())}&lang=${language}`,
        );
        const json = (await res.json()) as {
          data?: GeocodeSuggestion[];
          error?: { message: string };
        };
        if (json.data) {
          setSuggestions(json.data);
          setShowResults(true);
          setActiveIndex(-1);
        } else {
          setSearchError(copy.searchUnavailable);
          setSuggestions([]);
          setShowResults(false);
        }
      } catch {
        setSearchError(copy.searchUnavailable);
        setSuggestions([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    },
    [language, copy.searchUnavailable],
  );

  const startManualDraft = () => {
    setDraft({
      label: mode === 'pickup' ? copy.pickupTitle : copy.dropoffTitle,
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      fromDevice: false,
      photoUrl: value?.photoUrl ?? null,
    });
    setSearchError('');
  };

  const handleSelectSuggestion = (s: GeocodeSuggestion) => {
    setDraft({
      label: s.label,
      lat: s.latitude,
      lng: s.longitude,
      fromDevice: false,
      photoUrl: value?.photoUrl ?? null,
    });
    setQuery('');
    setSuggestions([]);
    setShowResults(false);
  };

  const handleUseCurrentLocation = () => {
    if (disabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMessage(copy.searchUnavailable);
      return;
    }
    setLocating(true);
    setGeoMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft({
          label: language === 'ar' ? 'موقعي الحالي' : 'My current location',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          fromDevice: true,
          photoUrl: value?.photoUrl ?? null,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGeoMessage(mapGeoErrorMessage(err.code));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const uploadPhoto = async (file: File) => {
    if (!allowPhoto) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', mode === 'pickup' ? 'pickup' : 'dropoff');
      const res = await fetch('/api/subscriptions/location-photo', { method: 'POST', body: fd });
      const json = (await res.json()) as { data?: { url: string } };
      if (json.data?.url) {
        setDraft((d) => (d ? { ...d, photoUrl: json.data!.url } : d));
      }
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleConfirm = () => {
    if (!draft) return;
    const label = sanitizeManualLabel(draft.label);
    if (!label) return;
    onConfirm({
      label,
      lat: draft.lat,
      lng: draft.lng,
      photoUrl: draft.photoUrl ?? null,
    });
  };

  const handleCancel = () => {
    setDraft(null);
    onCancel?.();
  };

  const markerColor = mapPickerMarkerColor(mode, draft?.fromDevice ?? false);
  const sectionTitle = mapPickerSectionTitle(mode, language);
  const placeholder =
    mode === 'pickup' ? copy.searchPlaceholderPickup : copy.searchPlaceholderDropoff;
  const setLabel = mode === 'pickup' ? copy.setPickup : copy.setDropoff;

  // ── Collapsed: confirmed card ──
  if (!expanded && value) {
    const mapsUrl = buildGoogleMapsPlaceUrl(value.lat, value.lng, value.label);
    return (
      <div
        className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/80 p-4"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
              mode === 'pickup' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{copy.confirmed}</p>
            <p className="mt-1 text-sm font-medium text-gray-900 break-words">{value.label}</p>
            <p className="mt-1 text-xs font-mono text-gray-500">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-emerald-700 hover:underline"
            >
              Google Maps
            </a>
            {value.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value.photoUrl}
                alt=""
                className="mt-3 h-16 w-16 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={onExpand}
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 min-h-[44px]"
            >
              {copy.change}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Collapsed: prompt to open ──
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onExpand}
        disabled={disabled}
        className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-white p-5 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/30 disabled:opacity-50 min-h-[72px]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <p className="text-sm font-semibold text-gray-900">{sectionTitle}</p>
        <p className="mt-1 text-sm text-emerald-700 font-medium">{setLabel}</p>
      </button>
    );
  }

  // ── Expanded picker ──
  return (
    <div
      ref={wrapperRef}
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
        <h3 className="text-base font-semibold text-gray-900">{sectionTitle}</h3>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {!draft && (
          <>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={disabled || locating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-60 min-h-[44px]"
            >
              {locating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              ) : (
                <Navigation className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {locating ? copy.locating : copy.useCurrentLocation}
            </button>
            {geoMessage && (
              <p className="text-xs text-amber-800" role="status">
                {geoMessage}
              </p>
            )}

            <div className="relative">
              <label htmlFor={inputId} className="sr-only">
                {sectionTitle}
              </label>
              <Search
                className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${
                  isRtl ? 'right-3' : 'left-3'
                }`}
                aria-hidden
              />
              <input
                id={inputId}
                type="search"
                value={query}
                disabled={disabled}
                autoComplete="off"
                role="combobox"
                aria-expanded={showResults}
                aria-controls={listId}
                placeholder={placeholder}
                onChange={(e) => {
                  const q = e.target.value;
                  setQuery(q);
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  debounceRef.current = setTimeout(() => void search(q), 350);
                }}
                onKeyDown={(e) => {
                  if (!showResults || suggestions.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && activeIndex >= 0) {
                    e.preventDefault();
                    handleSelectSuggestion(suggestions[activeIndex]!);
                  } else if (e.key === 'Escape') {
                    setShowResults(false);
                  }
                }}
                className={`input w-full py-3 ${isRtl ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3'}`}
              />
              {searching && (
                <span
                  className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent ${
                    isRtl ? 'left-3' : 'right-3'
                  }`}
                />
              )}
            </div>

            {searchError && (
              <p className="text-xs text-amber-800" role="alert">
                {searchError}
              </p>
            )}

            {showResults && (
              <ul
                id={listId}
                role="listbox"
                className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-md"
              >
                {suggestions.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-500">{copy.noResults}</li>
                ) : (
                  suggestions.map((s, i) => (
                    <li key={`${s.label}-${i}`} role="option" aria-selected={i === activeIndex}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(s);
                        }}
                        className={`w-full px-4 py-3 text-sm text-left hover:bg-emerald-50 break-words ${
                          i === activeIndex ? 'bg-emerald-50' : ''
                        } ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            <p className="text-xs text-gray-500">{copy.searchHint}</p>

            <button
              type="button"
              onClick={startManualDraft}
              disabled={disabled}
              className="text-sm font-medium text-emerald-700 hover:underline min-h-[44px]"
            >
              {copy.manualPin}
            </button>
          </>
        )}

        {draft && (
          <>
            <div className="space-y-2">
              {editingLabel ? (
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="input w-full"
                  aria-label={copy.editLabel}
                />
              ) : (
                <p className="text-sm font-medium text-gray-900 break-words">{draft.label}</p>
              )}
              <button
                type="button"
                onClick={() => setEditingLabel((v) => !v)}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                {copy.editLabel}
              </button>
              <p className="text-xs font-mono text-gray-500">
                {copy.coordinates}: {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
              </p>
            </div>

            <p className="text-xs text-gray-600">{copy.refineHint}</p>

            <div className="stable-map-shell relative z-0">
              <StableMapInnerMap
                lat={draft.lat}
                lng={draft.lng}
                markerColor={markerColor}
                active={expanded}
                onMove={(lat, lng) => setDraft((d) => (d ? { ...d, lat, lng } : d))}
              />
            </div>

            {allowPhoto && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">{copy.optionalPhoto}</p>
                {draft.photoUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.photoUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, photoUrl: null })}
                      className="text-xs text-red-600 hover:underline min-h-[44px]"
                    >
                      {copy.removePhoto}
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 min-h-[44px]">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={photoUploading || disabled}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadPhoto(f);
                        e.target.value = '';
                      }}
                    />
                    {photoUploading ? '…' : copy.addPhoto}
                  </label>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — outside map pane, always clickable */}
      <div className="stable-map-footer flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:justify-end sm:px-5">
        <button
          type="button"
          onClick={handleCancel}
          disabled={disabled}
          className="btn-outline w-full sm:w-auto min-h-[44px] px-5"
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || !draft}
          className="btn-primary w-full sm:w-auto min-h-[44px] px-5"
        >
          {copy.confirm}
        </button>
      </div>
    </div>
  );
}
