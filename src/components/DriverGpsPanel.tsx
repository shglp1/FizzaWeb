'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackingService } from '@/services/trackingService';
import { Ban, MapPin, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  GPS_DENIED_INSTRUCTIONS,
  GPS_OUTSIDE_WINDOW_LABEL,
  GPS_PERMISSION_EXPLAIN,
  getGpsPermissionLabel,
  type GpsPermissionUiState,
} from '@/lib/ui/driverPortal';

type SharingStatus =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'sharing'; lastSentAt: Date }
  | { kind: 'denied' }
  | { kind: 'error'; msg: string; lastSentAt: Date | null };

const MIN_MOVE_DEG = 0.0001;
const MIN_INTERVAL_MS = 10_000;
const STALE_MS = 60_000;

export function DriverGpsPanel({
  tripId,
  withinWindow = true,
  autoStart = false,
  isTerminal = false,
  onSharingChange,
}: {
  tripId: string;
  withinWindow?: boolean;
  /** When true, automatically start GPS sharing once permission is known to be granted. */
  autoStart?: boolean;
  /** When true, stop GPS sharing immediately (trip completed or cancelled). */
  isTerminal?: boolean;
  onSharingChange?: (active: boolean) => void;
}) {
  const [permissionState, setPermissionState] = useState<GpsPermissionUiState>('unknown');
  const [status, setStatus] = useState<SharingStatus>({ kind: 'idle' });

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ time: number; lat: number; lng: number } | null>(null);
  const promptAttemptedRef = useRef(false);
  const autoStartFiredRef = useRef(false);

  const probePermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setPermissionState('unsupported');
      return;
    }
    if (navigator.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        const map: Record<string, GpsPermissionUiState> = {
          granted: 'granted',
          denied: 'denied',
          prompt: 'prompt_needed',
        };
        setPermissionState(map[result.state] ?? 'unknown');
        result.onchange = () => {
          setPermissionState(map[result.state] ?? 'unknown');
        };
        return;
      } catch {
        /* fall through */
      }
    }
    setPermissionState('prompt_needed');
  }, []);

  useEffect(() => {
    probePermission();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [probePermission]);

  useEffect(() => {
    onSharingChange?.(status.kind === 'sharing');
  }, [status, onSharingChange]);

  // Auto-start: when autoStart is true and permission is granted and window is open,
  // start GPS sharing automatically without requiring driver to tap a button.
  useEffect(() => {
    if (
      autoStart &&
      withinWindow &&
      !isTerminal &&
      !autoStartFiredRef.current &&
      permissionState === 'granted' &&
      status.kind === 'idle'
    ) {
      autoStartFiredRef.current = true;
      startSharing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, withinWindow, isTerminal, permissionState]);

  // Auto-stop: when the trip reaches a terminal state, stop GPS sharing.
  useEffect(() => {
    if (isTerminal && status.kind === 'sharing') {
      stopSharing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTerminal]);

  function shouldSend(lat: number, lng: number): boolean {
    const prev = lastSentRef.current;
    if (!prev) return true;
    if (Date.now() - prev.time >= MIN_INTERVAL_MS) return true;
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
    if (!withinWindow) return;
    if (!navigator.geolocation) {
      setPermissionState('unsupported');
      setStatus({ kind: 'error', msg: 'Geolocation is not supported by this browser.', lastSentAt: null });
      return;
    }

    promptAttemptedRef.current = true;
    setStatus({ kind: 'requesting' });

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionState('granted');
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
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState(promptAttemptedRef.current ? 'denied_permanent' : 'denied');
          setStatus({ kind: 'denied' });
        } else {
          setStatus((prev) => ({
            kind: 'error',
            msg: `Location unavailable: ${error.message}`,
            lastSentAt: prev.kind === 'sharing' ? prev.lastSentAt : null,
          }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    watchIdRef.current = watchId;
  }

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const uiState: GpsPermissionUiState = !withinWindow
    ? 'outside_window'
    : status.kind === 'sharing' && lastSentRef.current && Date.now() - lastSentRef.current.time > STALE_MS
      ? 'stale'
      : status.kind === 'sharing'
        ? 'active'
        : status.kind === 'idle'
          ? permissionState
          : status.kind === 'denied'
            ? permissionState === 'denied_permanent' ? 'denied_permanent' : 'denied'
            : status.kind === 'error'
              ? 'error'
              : permissionState;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{getGpsPermissionLabel(uiState)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{GPS_PERMISSION_EXPLAIN}</p>
        </div>
      </div>

      {uiState === 'outside_window' && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">{GPS_OUTSIDE_WINDOW_LABEL}</p>
      )}

      {(uiState === 'denied' || uiState === 'denied_permanent') && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>{GPS_DENIED_INSTRUCTIONS}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { probePermission(); startSharing(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden />Retry
          </Button>
        </div>
      )}

      {uiState === 'unsupported' && (
        <p className="text-sm text-gray-600">This browser does not support location sharing.</p>
      )}

      {withinWindow && status.kind === 'idle' && permissionState !== 'denied' && permissionState !== 'denied_permanent' && permissionState !== 'unsupported' && (
        <Button variant="primary" size="sm" onClick={startSharing} className="min-h-10">
          Enable GPS sharing
        </Button>
      )}

      {status.kind === 'requesting' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse shrink-0" />
          Requesting location permission…
        </div>
      )}

      {status.kind === 'sharing' && (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 text-sm ${uiState === 'stale' ? 'text-amber-700' : 'text-emerald-700'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${uiState === 'stale' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="font-medium">{uiState === 'stale' ? 'GPS signal delayed' : 'Sharing active'}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">Last update: {fmtTime(status.lastSentAt)}</span>
          </div>
          {uiState === 'stale' && (
            <p className="text-xs text-amber-700">Location may be stale. Tap Retry if families cannot see you.</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={stopSharing}>Stop sharing</Button>
            {uiState === 'stale' && (
              <Button variant="ghost" size="sm" onClick={startSharing}><RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden />Retry</Button>
            )}
          </div>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 rounded-xl px-3 py-2.5 border border-orange-100">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>
              {status.msg}
              {status.lastSentAt && (
                <span className="block text-xs text-orange-500 mt-0.5">Last successful send: {fmtTime(status.lastSentAt)}</span>
              )}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={startSharing}><RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden />Retry</Button>
        </div>
      )}
    </div>
  );
}
