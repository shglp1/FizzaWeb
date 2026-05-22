'use client';
import { useEffect, useState, useCallback } from 'react';
import { systemConfigService } from '@/services/adminService';

type ConfigRow = { key: string; value: unknown; updatedAt: string };

const CONFIG_META: Record<string, { label: string; type: 'number' | 'text'; hint: string }> = {
  pricePerKmSar: {
    label: 'Price per KM (SAR)',
    type: 'number',
    hint: 'Distance charge per kilometre added to subscription price.',
  },
  extraRiderSameDropoffMultiplier: {
    label: 'Extra Rider Multiplier',
    type: 'number',
    hint: 'Fraction of primary price charged for each additional rider. Default: 0.5 (50%).',
  },
  maxTripGenerationDays: {
    label: 'Max Trip Generation Days',
    type: 'number',
    hint: 'Max days ahead that trips are auto-generated.',
  },
  supportPhone: {
    label: 'Support Phone',
    type: 'text',
    hint: 'Customer-facing support phone number.',
  },
  supportWhatsApp: {
    label: 'Support WhatsApp',
    type: 'text',
    hint: 'Customer-facing WhatsApp number.',
  },
  notificationLeadTimeMinutes: {
    label: 'Notification Lead Time (min)',
    type: 'number',
    hint: 'Minutes before pickup that pickup reminder is sent.',
  },
  loyaltyPointsPerSar: {
    label: 'Loyalty Points per SAR',
    type: 'number',
    hint: 'Points awarded per SAR paid.',
  },
  loyaltyPointsOnSafetyApproval: {
    label: 'Loyalty Points on Safety Approval',
    type: 'number',
    hint: 'Points awarded when a safety report is approved.',
  },
};

export function SystemConfigSection() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    systemConfigService.list().then((res) => {
      if (res.data) {
        setConfigs(res.data as ConfigRow[]);
        const initial: Record<string, string> = {};
        (res.data as ConfigRow[]).forEach((c) => {
          initial[c.key] = String(c.value ?? '');
        });
        // Set defaults for missing keys
        Object.keys(CONFIG_META).forEach((k) => {
          if (!(k in initial)) initial[k] = '';
        });
        setForm(initial);
      } else {
        setError(res.error?.message ?? 'Failed to load configuration.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
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
      setSaveMsg('Configuration saved successfully.');
      load();
    } else {
      setSaveMsg(res.error?.message ?? 'Save failed.');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400">Loading configuration…</div>;
  if (error) return <div className="card text-red-600 text-sm">{error}</div>;

  const lastUpdated = configs.reduce<string | null>((latest, c) => {
    if (!latest || c.updatedAt > latest) return c.updatedAt;
    return latest;
  }, null);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">System Configuration</h2>
        {lastUpdated && (
          <p className="text-xs text-gray-400">Last updated {new Date(lastUpdated).toLocaleString()}</p>
        )}
      </div>

      <div className="space-y-4 max-w-xl">
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
            <p className="text-xs text-gray-400 mt-0.5">{meta.hint}</p>
          </div>
        ))}
      </div>

      {saveMsg && (
        <p className={`mt-4 text-sm rounded-xl px-4 py-2.5 w-fit ${
          saveMsg.includes('fail') || saveMsg.includes('Fail') ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
        }`}>
          {saveMsg}
        </p>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary mt-6 px-6 py-2.5">
        {saving ? 'Saving…' : 'Save Configuration'}
      </button>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 max-w-xl">
        <p className="font-semibold mb-1">Pricing note</p>
        <p>Distance charges: <code>finalPrice = packagePrice + addOns + (distanceKm × pricePerKmSar)</code></p>
        <p className="mt-1">Extra riders: <code>+ (numExtraRiders × primaryPrice × extraRiderMultiplier)</code></p>
        <p className="mt-1 text-amber-600">Distance is entered manually by the user. Geocoding API integration is pending.</p>
      </div>
    </>
  );
}
