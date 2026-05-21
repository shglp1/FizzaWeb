'use client';
import { useEffect, useRef, useState } from 'react';
import { trackingService } from '@/services/trackingService';

type GpsStatus =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'sharing'; lastSentAt: Date }
  | { kind: 'denied' }
  | { kind: 'error'; msg: string; lastSentAt: Date | null };

// Minimum change (≈11 m) or elapsed seconds before we send another ping
const MIN_MOVE_DEG = 0.0001;
const MIN_INTERVAL_MS = 10_000;

export function DriverGpsPanel({ tripId }: { tripId: string }) {
  const [status, setStatus] = useState<GpsStatus>({ kind: 'idle' });

  // Refs never trigger re-renders
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ time: number; lat: number; lng: number } | null>(null);

  // Clean up watch when component unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  function shouldSend(lat: number, lng: number): boolean {
    const prev = lastSentRef.current;
    if (!prev) return true;
    const elapsed = Date.now() - prev.time;
    if (elapsed >= MIN_INTERVAL_MS) return true;
    return Math.hypot(lat - prev.lat, lng - prev.lng) >= MIN_MOVE_DEG;
  }

  function stopSharing() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastSentRef.current = null;
    setStatus({ kind: 'idle' });
  }

  function startSharing() {
    if (!navigator.geolocation) {
      setStatus({ kind: 'error', msg: 'Geolocation is not supported by this browser.', lastSentAt: null });
      return;
    }

    setStatus({ kind: 'requesting' });

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        if (!shouldSend(lat, lng)) return;

        trackingService.updateLocation(tripId, lat, lng).then((res) => {
          const sentAt = new Date();
          lastSentRef.current = { time: Date.now(), lat, lng };

          if (res.error) {
            setStatus((prev) => ({
              kind: 'error',
              msg: res.error?.message ?? 'Failed to send location.',
              lastSentAt: prev.kind === 'sharing' ? prev.lastSentAt : prev.kind === 'error' ? prev.lastSentAt : null,
            }));
          } else {
            setStatus({ kind: 'sharing', lastSentAt: sentAt });
          }
        }).catch(() => {
          setStatus((prev) => ({
            kind: 'error',
            msg: 'Network error — could not reach server.',
            lastSentAt: prev.kind === 'sharing' ? prev.lastSentAt : prev.kind === 'error' ? prev.lastSentAt : null,
          }));
        });
      },
      (error) => {
        // Clear watch on any geo error
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        const denied = error.code === error.PERMISSION_DENIED;
        if (denied) {
          setStatus({ kind: 'denied' });
        } else {
          setStatus((prev) => ({
            kind: 'error',
            msg: `Location unavailable: ${error.message}`,
            lastSentAt: prev.kind === 'sharing' ? prev.lastSentAt : null,
          }));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );

    watchIdRef.current = watchId;
  }

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        📍 Driver Location Sharing
      </p>

      {status.kind === 'idle' && (
        <button
          onClick={startSharing}
          className="text-sm px-4 py-2 rounded-xl font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          Start Sharing Location
        </button>
      )}

      {status.kind === 'requesting' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse shrink-0" />
          Requesting location permission…
        </div>
      )}

      {status.kind === 'sharing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-medium">Sharing active</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">Last sent: {fmtTime(status.lastSentAt)}</span>
          </div>
          <button
            onClick={stopSharing}
            className="text-sm px-4 py-2 rounded-xl font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Stop Sharing
          </button>
        </div>
      )}

      {status.kind === 'denied' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
            <span className="shrink-0 mt-0.5">🚫</span>
            <span>
              Location access denied.{' '}
              <span className="font-medium">Enable location in your browser settings</span> then try again.
            </span>
          </div>
          <button
            onClick={startSharing}
            className="text-sm px-4 py-2 rounded-xl font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 rounded-xl px-3 py-2.5 border border-orange-100">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>
              {status.msg}
              {status.lastSentAt && (
                <span className="block text-xs text-orange-500 mt-0.5">
                  Last successful send: {fmtTime(status.lastSentAt)}
                </span>
              )}
            </span>
          </div>
          <button
            onClick={startSharing}
            className="text-sm px-4 py-2 rounded-xl font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
