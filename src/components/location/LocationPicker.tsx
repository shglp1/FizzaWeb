'use client';
/**
 * LocationPicker — enterprise location search/autocomplete component.
 *
 * Calls /api/maps/geocode (server-side proxy) on behalf of the user.
 * The ORS API key is never exposed to the browser.
 *
 * Features:
 *  - Debounced search (350ms) to avoid flooding the API
 *  - Dropdown with up to 5 suggestions
 *  - Selected-location card with clear button
 *  - Loading, error, and empty states
 *  - Keyboard-accessible dropdown
 *  - Mobile responsive
 */

import { useState, useRef, useCallback, useEffect, useId } from 'react';

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

export interface LocationPickerProps {
  /** Input label shown above the field. */
  label: string;
  /** Currently selected location (null = nothing selected yet). */
  value: SelectedLocation | null;
  /** Called when the user selects a suggestion or clears the selection. */
  onChange: (loc: SelectedLocation | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Extra Tailwind classes for the outer wrapper. */
  className?: string;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationPicker({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className = '',
}: LocationPickerProps) {
  const inputId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(q.trim())}`);
      const json = (await res.json()) as {
        data?: GeocodeResult[];
        error?: { message: string };
      };

      if (json.data) {
        setSuggestions(json.data);
        setShowDropdown(true);
        setActiveIndex(-1);
      } else {
        const msg = json.error?.message ?? 'Location search failed.';
        // Surface friendly error; don't show raw provider messages
        if (res.status === 503 || res.status === 502) {
          setSearchError('Location service is temporarily unavailable. Please try again later.');
        } else {
          setSearchError(msg);
        }
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch {
      setSearchError('Could not reach the location service. Check your connection and try again.');
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(q), 350);
  };

  const handleSelect = (loc: GeocodeResult) => {
    onChange(loc);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    setSearchError('');
    // Refocus input after clearing
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const loc = suggestions[activeIndex];
      if (loc) handleSelect(loc);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  // ── If a location is already selected, show the confirmed card ──
  if (value) {
    return (
      <div className={`space-y-1 ${className}`}>
        <p className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </p>
        <div className="flex items-start gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2.5">
          <span className="mt-0.5 shrink-0 text-emerald-600">
            <PinIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-gray-800 break-words">
              {value.label}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              aria-label={`Clear ${label}`}
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Search input + dropdown ──
  return (
    <div ref={wrapperRef} className={`relative space-y-1 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {/* Input row */}
      <div className="relative">
        {/* Search icon */}
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
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder ?? 'Type an address, district, or landmark…'}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `loc-opt-${activeIndex}` : undefined}
          className={[
            'w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors',
            'focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200',
            disabled ? 'cursor-not-allowed bg-gray-50 opacity-60' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>

      {/* Error message */}
      {searchError && (
        <p className="text-xs text-red-600" role="alert">
          {searchError}
        </p>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-400 italic">
              No locations found. Try adding a city or neighborhood.
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={`${s.label}-${i}`}
                id={`loc-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers
                    e.preventDefault();
                    handleSelect(s);
                  }}
                  className={[
                    'flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm transition-colors',
                    i === activeIndex
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-gray-700 hover:bg-gray-50',
                    i < suggestions.length - 1 ? 'border-b border-gray-100' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="mt-0.5 shrink-0 text-gray-400">
                    <PinIcon />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug break-words">{s.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Helper text when no query yet */}
      {!query && !searchError && (
        <p className="text-xs text-gray-400">
          Type at least 3 characters to search for a location.
        </p>
      )}
    </div>
  );
}
