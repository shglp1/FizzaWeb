'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { adminPromoService } from '@/services/adminService';
import { Button, Alert, Input, Textarea } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminDataCard,
  AdminStatusBadge,
  AdminEmptyState,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';
import { formatSar } from '@/lib/ui/adminCurrency';

type PromoCode = {
  id: string;
  code: string;
  partnerName: string | null;
  discountPercent: number;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  isActive: boolean;
  totalDiscountSar: string | number;
  totalPaidSar: string | number;
  notes: string | null;
  createdAt: string;
  _count?: { redemptions: number };
};

const EMPTY = {
  code: '',
  partnerName: '',
  discountPercent: '10',
  maxUses: '',
  expiresAt: '',
  notes: '',
};

export function PromoCodesPanel() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminPromoService.list().then((res) => {
      if (res.error) setError(res.error.message);
      else setCodes((res.data as PromoCode[]) ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setMsg('');
    setError('');
    setCreating(true);
    const res = await adminPromoService.create({
      code: form.code,
      partnerName: form.partnerName || null,
      discountPercent: Number(form.discountPercent),
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      notes: form.notes || null,
    });
    setCreating(false);
    if (res.error) setError(res.error.message);
    else {
      setMsg('Promo code created');
      setForm(EMPTY);
      load();
    }
  };

  const toggleActive = async (code: PromoCode) => {
    await adminPromoService.update(code.id, { isActive: !code.isActive });
    load();
  };

  if (loading) return <AdminSectionLoading message="Loading promo codes…" />;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Promo & influencer codes"
        subtitle="Generate percentage discounts for marketers. Usage, revenue, and discount totals update when parents pay for subscriptions."
      />

      {error && <Alert variant="error">{error}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}

      <div className="card-md p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Create code</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input label="Code" placeholder="FAMOUS20" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
          <Input label="Partner / influencer" placeholder="Name for reporting" value={form.partnerName} onChange={(e) => setForm((p) => ({ ...p, partnerName: e.target.value }))} />
          <Input label="Discount %" type="number" min={1} max={100} value={form.discountPercent} onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))} />
          <Input label="Max uses" type="number" min={1} placeholder="Unlimited if empty" value={form.maxUses} onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))} />
          <Input label="Expires" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
        </div>
        <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        <Button variant="primary" loading={creating} onClick={handleCreate}>Generate code</Button>
      </div>

      {codes.length === 0 ? (
        <AdminEmptyState icon={Tag} title="No promo codes yet" description="Create a code for influencers or marketing campaigns." />
      ) : (
        <div className="grid gap-4">
          {codes.map((c) => (
            <AdminDataCard key={c.id} title={c.code} subtitle={c.partnerName ?? undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-emerald-700 font-medium">{c.discountPercent}% off subscription</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <AdminStatusBadge status={c.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <Button variant="outline" size="sm" onClick={() => toggleActive(c)}>{c.isActive ? 'Deactivate' : 'Activate'}</Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
                <div><span className="text-gray-400 block text-xs">Uses</span>{c.useCount}{c.maxUses != null ? ` / ${c.maxUses}` : ' / ∞'} ({c.maxUses != null ? `${Math.max(0, c.maxUses - c.useCount)} left` : 'unlimited'})</div>
                <div><span className="text-gray-400 block text-xs">Total discount given</span>{formatSar(Number(c.totalDiscountSar))}</div>
                <div><span className="text-gray-400 block text-xs">Total paid (after discount)</span>{formatSar(Number(c.totalPaidSar))}</div>
                <div><span className="text-gray-400 block text-xs">Expiry</span>{c.expiresAt ? (new Date(c.expiresAt).getTime() < Date.now() ? 'Expired' : new Date(c.expiresAt).toLocaleString('en-SA')) : 'Never'}</div>
              </div>
            </AdminDataCard>
          ))}
        </div>
      )}
    </div>
  );
}
