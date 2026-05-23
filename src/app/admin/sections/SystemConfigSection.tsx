'use client';
import { useEffect, useState, useCallback } from 'react';
import { systemConfigService } from '@/services/adminService';
import { Card, Alert, Button, LoadingState, ErrorState } from '@/components/ui';

type DistanceStatus = {
  configured: boolean;
  provider: string;
  providerLabel: string;
};

type ConfigRow = { key: string; value: unknown; updatedAt: string };

const CONFIG_META: Record<string, { label: string; type: 'number' | 'text'; hint: string }> = {
  pricePerKmSar:                    { label: 'Price per KM (SAR)',                type: 'number', hint: 'Distance charge per kilometre added to subscription price. Changing this affects new quotes only — existing subscriptions keep their saved price snapshot.' },
  extraRiderSameDropoffMultiplier:   { label: 'Extra Rider Multiplier',            type: 'number', hint: 'Fraction of primary price charged for each additional rider. Default: 0.5 (50%).' },
  maxTripGenerationDays:            { label: 'Max Trip Generation Days',           type: 'number', hint: 'Max days ahead that trips are auto-generated.' },
  supportPhone:                     { label: 'Support Phone',                      type: 'text',   hint: 'Customer-facing support phone number.' },
  supportWhatsApp:                  { label: 'Support WhatsApp',                   type: 'text',   hint: 'Customer-facing WhatsApp number.' },
  notificationLeadTimeMinutes:      { label: 'Notification Lead Time (min)',       type: 'number', hint: 'Minutes before pickup that pickup reminder is sent.' },
  loyaltyPointsPerSar:              { label: 'Loyalty Points per SAR',             type: 'number', hint: 'Points awarded per SAR paid.' },
  loyaltyPointsOnSafetyApproval:   { label: 'Loyalty Points on Safety Approval',  type: 'number', hint: 'Points awarded when a safety report is approved.' },
};

export function SystemConfigSection() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    systemConfigService.list().then((res) => {
      if (res.data) {
        setConfigs(res.data as ConfigRow[]);
        const initial: Record<string, string> = {};
        (res.data as ConfigRow[]).forEach((c) => { initial[c.key] = String(c.value ?? ''); });
        Object.keys(CONFIG_META).forEach((k) => { if (!(k in initial)) initial[k] = ''; });
        setForm(initial);
      } else {
        setError(res.error?.message ?? 'Failed to load configuration.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load distance provider status separately (fire-and-forget; failure is non-blocking)
  useEffect(() => {
    fetch('/api/admin/system/distance-status')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setDistanceStatus(json.data as DistanceStatus);
      })
      .catch(() => { /* silently ignore — status panel degrades gracefully */ });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const updates: Record<string, string | number> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (!v.trim()) return;
      const meta = CONFIG_META[k];
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

  if (loading) return <LoadingState message="Loading configuration…" />;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  const lastUpdated = configs.reduce<string | null>((latest, c) => {
    if (!latest || c.updatedAt > latest) return c.updatedAt;
    return latest;
  }, null);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">System Configuration</h2>
        {lastUpdated && (
          <p className="text-xs text-gray-400">Last updated {new Date(lastUpdated).toLocaleString()}</p>
        )}
      </div>

      <Card className="max-w-xl mb-5">
        <div className="space-y-5">
          {Object.entries(CONFIG_META).map(([key, meta]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{meta.label}</label>
              <input
                type={meta.type === 'number' ? 'number' : 'text'}
                step={meta.type === 'number' ? 'any' : undefined}
                className="input w-full text-sm"
                value={form[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={meta.type === 'number' ? 'Enter number…' : 'Enter value…'}
              />
              <p className="text-xs text-gray-400 mt-1">{meta.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      {saveMsg && (
        <Alert variant={saveMsg.type} className="mb-4 max-w-xl" onClose={() => setSaveMsg(null)}>
          {saveMsg.text}
        </Alert>
      )}

      <Button variant="primary" loading={saving} onClick={handleSave} className="px-8">
        Save Configuration
      </Button>

      {/* Formula reference */}
      <div className="mt-6 max-w-xl space-y-3">
        <Card className="bg-amber-50 border-amber-100">
          <p className="text-xs font-semibold text-amber-800 mb-2">Pricing Formula</p>
          <div className="space-y-1 text-xs text-amber-700 font-mono">
            <p>chargeableKm = oneWayKm × 2 (ROUND_TRIP) or × 1 (ONE_WAY)</p>
            <p>primaryPrice = packagePrice + addOns + (chargeableKm × pricePerKmSar)</p>
            <p>finalPrice = primaryPrice + (numExtraRiders × primaryPrice × extraRiderMultiplier)</p>
          </div>
          <p className="text-xs text-amber-600 mt-2 font-sans">
            Distance is calculated automatically using real road routing (OpenRouteService). Users do not enter distance manually.
          </p>
        </Card>

        {/* Distance Provider Status */}
        {distanceStatus ? (
          <Card className={distanceStatus.configured ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-200'}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${distanceStatus.configured ? 'bg-emerald-500' : 'bg-red-500'}`}
                aria-hidden="true"
              />
              <p className={`text-xs font-semibold ${distanceStatus.configured ? 'text-blue-800' : 'text-red-800'}`}>
                Distance Provider: {distanceStatus.configured ? 'Configured' : 'Not Configured'}
              </p>
            </div>
            <p className="text-xs text-gray-600 mb-1">
              Provider: <span className="font-semibold">{distanceStatus.providerLabel}</span>
            </p>
            {distanceStatus.configured ? (
              <p className="text-xs text-blue-700">
                API key is active. Users can calculate subscription quotes.
                The key is stored server-side only and never exposed to the browser.
              </p>
            ) : (
              <p className="text-xs text-red-700 font-medium">
                Distance calculation is not configured. Users cannot calculate subscription quotes.
                Set the <code className="bg-red-100 px-0.5 rounded">OPENROUTESERVICE_API_KEY</code> environment variable to enable pricing.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2 italic">
              Note: Changing Price per KM affects new quotes only. Existing subscriptions retain their saved final price snapshot.
            </p>
          </Card>
        ) : (
          <Card className="bg-blue-50 border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-2">Distance Provider</p>
            <p className="text-xs text-blue-700">
              Provider: <span className="font-semibold">OpenRouteService</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              API key is configured via server environment variables and never exposed to the client.
            </p>
            <p className="text-xs text-gray-400 mt-2 italic">
              Note: Changing Price per KM affects new quotes only. Existing subscriptions retain their saved final price snapshot.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
