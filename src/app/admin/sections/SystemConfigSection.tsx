'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Settings, MapPin } from 'lucide-react';
import { systemConfigService } from '@/services/adminService';
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
  const [activeGroup, setActiveGroup] = useState<ConfigGroupId>('pricing');

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
  }, []);

  const dirty = useMemo(
    () => Object.keys(CONFIG_FIELD_META).some((k) => form[k] !== savedForm[k]),
    [form, savedForm],
  );

  const lastUpdated = configs.reduce<string | null>((latest, c) => {
    if (!latest || c.updatedAt > latest) return c.updatedAt;
    return latest;
  }, null);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
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

  const handleDiscard = () => setForm(savedForm);

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
        )}

        {activeGroup === 'chat' && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            Chat moderation is managed from the Trips operations board (flagged messages panel). No additional config keys are required here.
          </div>
        )}

        {activeGroup === 'pricing' && (
          <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">Pricing formula reference</p>
            <div className="space-y-1 text-xs text-amber-700 font-mono">
              <p>chargeableKm = oneWayKm x 2 (ROUND_TRIP) or x 1 (ONE_WAY)</p>
              <p>primaryPrice = packagePrice + addOns + (chargeableKm x pricePerKmSar)</p>
              <p>finalPrice = primaryPrice + (numExtraRiders x primaryPrice x extraRiderMultiplier)</p>
            </div>
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
                  type={meta.type === 'number' ? 'number' : 'text'}
                  step={meta.type === 'number' ? 'any' : undefined}
                  className="input w-full text-sm min-h-[44px]"
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={meta.recommended ? `Recommended: ${meta.recommended}` : 'Enter value…'}
                />
                <p className="text-xs text-gray-500 mt-2">{meta.hint}</p>
                {meta.recommended && (
                  <p className="text-xs text-gray-400 mt-1">Recommended default: {meta.recommended}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
