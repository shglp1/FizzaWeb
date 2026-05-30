'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Settings, MapPin, TriangleAlert } from 'lucide-react';
import { systemConfigService, adminMapDiagnosticsService } from '@/services/adminService';
import { Alert, ErrorState } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminTabs,
  AdminStickySaveBar,
  AdminSectionLoading,
  AdminStatusBadge,
} from '@/components/admin/AdminUI';
import {
  CONFIG_FIELD_META,
  CONFIG_GROUPS,
  getConfigFieldStatus,
  type ConfigGroupId,
} from '@/lib/ui/systemConfigGroups';

type DistanceStatus = {
  configured: boolean;
  provider: string;
  providerLabel: string;
};

type MapDiagnostics = {
  timestamp: string;
  orsConfigured: boolean;
  osrmReachable: boolean;
  nominatimReachable: boolean;
  osmTileCspConfigured: boolean;
  mapPlaces: { total: number; verified: number };
  geocodeCache: { total: number; active: number };
  storageDriver: string;
};

type ConfigRow = { key: string; value: unknown; updatedAt: string };

export function SystemConfigSection() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [savedForm, setSavedForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus | null>(null);
  const [mapDiagnostics, setMapDiagnostics] = useState<MapDiagnostics | null>(null);
  const [activeGroup, setActiveGroup] = useState<ConfigGroupId>('pricing');
  const [showFinancialWarning, setShowFinancialWarning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    systemConfigService.list().then((res) => {
      if (res.data) {
        setConfigs(res.data as ConfigRow[]);
        const initial: Record<string, string> = {};
        (res.data as ConfigRow[]).forEach((c) => { initial[c.key] = String(c.value ?? ''); });
        Object.keys(CONFIG_FIELD_META).forEach((k) => { if (!(k in initial)) initial[k] = ''; });
        setForm(initial);
        setSavedForm(initial);
      } else {
        setError(res.error?.message ?? 'Failed to load configuration.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/admin/system/distance-status')
      .then((r) => r.json())
      .then((json) => { if (json.data) setDistanceStatus(json.data as DistanceStatus); })
      .catch(() => {});
    adminMapDiagnosticsService.get().then((res) => {
      if (res.data) setMapDiagnostics(res.data as MapDiagnostics);
    });
  }, []);

  const dirty = useMemo(
    () => Object.keys(CONFIG_FIELD_META).some((k) => form[k] !== savedForm[k]),
    [form, savedForm],
  );

  const lastUpdated = configs.reduce<string | null>((latest, c) => {
    if (!latest || c.updatedAt > latest) return c.updatedAt;
    return latest;
  }, null);

  const FINANCIAL_SENSITIVE_KEYS = ['pricePerKmSar', 'driverPayRatePerKmSar', 'driverPlatformFeePercent', 'extraRiderSameDropoffMultiplier'];

  const financialKeysChanged = useMemo(
    () => FINANCIAL_SENSITIVE_KEYS.some((k) => form[k] !== undefined && form[k] !== savedForm[k]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, savedForm],
  );

  const doSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    setShowFinancialWarning(false);
    const updates: Record<string, string | number> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (!v.trim()) return;
      const meta = CONFIG_FIELD_META[k];
      if (meta?.type === 'number') {
        const n = parseFloat(v);
        if (!isNaN(n)) updates[k] = n;
      } else {
        updates[k] = v.trim();
      }
    });
    const res = await systemConfigService.update(updates);
    setSaving(false);
    if (res.data) {
      setSaveMsg({ text: 'Configuration saved successfully.', type: 'success' });
      load();
    } else {
      setSaveMsg({ text: res.error?.message ?? 'Save failed.', type: 'error' });
    }
  };

  const handleSave = () => {
    if (financialKeysChanged) {
      setShowFinancialWarning(true);
    } else {
      void doSave();
    }
  };

  const handleDiscard = () => {
    setForm(savedForm);
    setShowFinancialWarning(false);
  };

  if (loading) return <AdminSectionLoading message="Loading configuration…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const group = CONFIG_GROUPS.find((g) => g.id === activeGroup)!;
  const tabs = CONFIG_GROUPS.map((g) => ({ label: g.label, value: g.id }));

  return (
    <div className="space-y-5 pb-20">
      <AdminSectionHeader
        title="System Configuration"
        subtitle="Platform-wide settings grouped by operational area"
        lastUpdated={lastUpdated ? new Date(lastUpdated).toLocaleString() : undefined}
        primaryAction={
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Settings className="h-4 w-4" aria-hidden />
            {Object.keys(CONFIG_FIELD_META).filter((k) => getConfigFieldStatus(k, form[k] ?? '') === 'configured').length} configured
          </span>
        }
      />

      {saveMsg && (
        <Alert variant={saveMsg.type} onClose={() => setSaveMsg(null)}>{saveMsg.text}</Alert>
      )}

      <AdminTabs tabs={tabs} active={activeGroup} onChange={(v) => setActiveGroup(v as ConfigGroupId)} />

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{group.label}</h3>
        <p className="text-sm text-gray-500 mb-5">{group.description}</p>

        {activeGroup === 'tracking' && (
          <div className="space-y-4 mb-5">
            <div className={`rounded-xl border p-4 ${distanceStatus?.configured ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4" aria-hidden />
                <p className="text-sm font-semibold text-gray-800">
                  Distance Provider: {distanceStatus?.providerLabel ?? 'OpenRouteService'}
                </p>
                <AdminStatusBadge
                  status={distanceStatus?.configured ? 'ACTIVE' : 'FAILED'}
                  label={distanceStatus?.configured ? 'Configured' : 'Not configured'}
                />
              </div>
              <p className="text-xs text-gray-600">
                {distanceStatus?.configured
                  ? 'API key is active. Distance is calculated server-side and never exposed to clients.'
                  : 'Set OPENROUTESERVICE_API_KEY in server environment to enable subscription quote distance pricing.'}
              </p>
            </div>

            {mapDiagnostics && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Maps &amp; Location Diagnostics</p>
                <p className="text-xs text-gray-500">Last check: {new Date(mapDiagnostics.timestamp).toLocaleString()}</p>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  <p>ORS: {mapDiagnostics.orsConfigured ? 'Configured' : 'Missing key'}</p>
                  <p>OSRM fallback: {mapDiagnostics.osrmReachable ? 'Reachable' : 'Unreachable'}</p>
                  <p>Nominatim fallback: {mapDiagnostics.nominatimReachable ? 'Reachable' : 'Unreachable'}</p>
                  <p>OSM tile CSP: {mapDiagnostics.osmTileCspConfigured ? 'OK' : 'Check next.config.ts'}</p>
                  <p>Verified places: {mapDiagnostics.mapPlaces.verified} / {mapDiagnostics.mapPlaces.total}</p>
                  <p>Geocode cache: {mapDiagnostics.geocodeCache.active} active / {mapDiagnostics.geocodeCache.total} total</p>
                  <p>Storage driver: {mapDiagnostics.storageDriver}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeGroup === 'chat' && (
          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-800">
            Message flagging and moderation actions remain in the Trips operations board. Timing and attachment defaults below apply to all new trip chats.
          </div>
        )}

        {activeGroup === 'payroll' && (() => {
          const driverRate = parseFloat(form.driverPayRatePerKmSar ?? '');
          const parentRate = parseFloat(form.pricePerKmSar ?? '');
          if (Number.isFinite(driverRate) && Number.isFinite(parentRate) && driverRate > parentRate) {
            return (
              <div className="mb-5">
                <Alert variant="warning">
                  Warning: Driver pay rate per km is higher than the parent distance charge per km. The package fee must cover the difference to keep this subscription profitable.
                </Alert>
              </div>
            );
          }
          return null;
        })()}

        {activeGroup === 'pricing' && (
          <div className="mb-5 space-y-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">Pricing formula reference</p>
              <div className="space-y-1 text-xs text-amber-700 font-mono">
                <p>chargeableKm = oneWayKm x 2 (ROUND_TRIP) or x 1 (ONE_WAY)</p>
                <p>primaryPrice = packagePrice + addOns + (chargeableKm x pricePerKmSar)</p>
                <p>finalPrice = primaryPrice + (numExtraRiders x primaryPrice x extraRiderMultiplier)</p>
              </div>
            </div>
            {(() => {
              const driverRate = parseFloat(form.driverPayRatePerKmSar ?? '');
              const parentRate = parseFloat(form.pricePerKmSar ?? '');
              if (
                Number.isFinite(driverRate)
                && Number.isFinite(parentRate)
                && driverRate > parentRate
              ) {
                return (
                  <Alert variant="warning">
                    Warning: Driver pay rate per km is higher than the parent distance charge per km. The package fee must cover the difference to keep this subscription profitable.
                  </Alert>
                );
              }
              return null;
            })()}
          </div>
        )}

        <div className="space-y-5">
          {group.keys.map((key) => {
            const meta = CONFIG_FIELD_META[key];
            if (!meta) return null;
            const status = getConfigFieldStatus(key, form[key] ?? '');
            return (
              <div key={key} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <label htmlFor={`cfg-${key}`} className="text-sm font-semibold text-gray-800">{meta.label}</label>
                  <AdminStatusBadge
                    status={status === 'configured' ? 'ACTIVE' : status === 'missing' ? 'PENDING' : 'FAILED'}
                    label={status === 'configured' ? 'Configured' : status === 'missing' ? 'Missing' : 'Invalid'}
                  />
                </div>
                <input
                  id={`cfg-${key}`}
                  type={meta.type === 'number' ? 'number' : meta.type === 'boolean' ? 'text' : 'text'}
                  step={meta.type === 'number' ? 'any' : undefined}
                  className="input w-full text-sm min-h-[44px]"
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={meta.recommended ? `Recommended: ${meta.recommended}` : 'Enter value…'}
                  list={meta.type === 'boolean' ? `cfg-${key}-opts` : undefined}
                />
                {meta.type === 'boolean' && (
                  <datalist id={`cfg-${key}-opts`}>
                    <option value="true" /><option value="false" />
                  </datalist>
                )}
                <p className="text-xs text-gray-500 mt-2">{meta.hint}</p>
                {meta.recommended && (
                  <p className="text-xs text-gray-400 mt-1">Recommended default: {meta.recommended}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showFinancialWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Financial settings warning">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
                <TriangleAlert className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Financial settings changed</h3>
                <p className="text-sm text-gray-600">
                  You have modified one or more pricing or payout keys ({FINANCIAL_SENSITIVE_KEYS.filter((k) => form[k] !== savedForm[k]).join(', ')}).
                  These changes affect all future trip pricing and driver payouts immediately after saving.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Please confirm you have reviewed the new values carefully. This action cannot be automatically reverted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="btn btn-ghost text-sm min-h-[40px] px-4"
                onClick={() => setShowFinancialWarning(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn bg-amber-500 hover:bg-amber-600 text-white text-sm min-h-[40px] px-4 font-semibold"
                onClick={() => void doSave()}
              >
                Save anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminStickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        message="Unsaved configuration changes"
      />
    </div>
  );
}
