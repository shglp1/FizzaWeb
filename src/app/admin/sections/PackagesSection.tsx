'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminPackageService, adminAddOnService } from '@/services/adminService';
import { Card, Badge, Button, Alert, Input, Textarea, LoadingState, ErrorState } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Package {
  id: string;
  name: string;
  billingCycle: string;
  priceSar: string | number;
  description?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
  createdAt: string;
  _count?: { userSubscriptions: number };
}

interface AddOn {
  id: string;
  name: string;
  priceSar: string | number;
  description?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
  createdAt: string;
  _count?: { subscriptionAddOns: number };
}

type ActiveTab = 'packages' | 'addons';

// ─── PackagesSection (tab switcher) ──────────────────────────────────────────

export function PackagesSection() {
  const [tab, setTab] = useState<ActiveTab>('packages');

  return (
    <div className="space-y-4">
      <div className="flex gap-0 border-b border-gray-200 mb-5">
        {(['packages', 'addons'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-fizza-secondary text-fizza-secondary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'packages' ? 'Subscription Packages' : 'Add-ons'}
          </button>
        ))}
      </div>
      {tab === 'packages' ? <PackagesTab /> : <AddOnsTab />}
    </div>
  );
}

// ─── Shared form field ────────────────────────────────────────────────────────

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── PackagesTab ──────────────────────────────────────────────────────────────

type PkgForm = { name: string; billingCycle: string; priceSar: string; description: string; sortOrder: string; isActive: boolean };

function PackagesTab() {
  const [packages, setPackages]     = useState<Package[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionMsg, setActionMsg]   = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const EMPTY: PkgForm = { name: '', billingCycle: 'monthly', priceSar: '', description: '', sortOrder: '', isActive: true };
  const [form, setForm] = useState<PkgForm>(EMPTY);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminPackageService.list(showInactive).then((res) => {
      if (res.error) setError(res.error.message);
      else setPackages((res.data as Package[]) ?? []);
      setLoading(false);
    });
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (pkg: Package) => {
    setEditId(pkg.id); setShowCreate(false);
    setForm({ name: pkg.name, billingCycle: pkg.billingCycle, priceSar: String(pkg.priceSar), description: pkg.description ?? '', sortOrder: pkg.sortOrder != null ? String(pkg.sortOrder) : '', isActive: pkg.isActive });
  };

  const startCreate = () => { setEditId(null); setShowCreate(true); setForm(EMPTY); };

  const handleSave = async () => {
    const data = { name: form.name.trim(), billingCycle: form.billingCycle.trim(), priceSar: parseFloat(form.priceSar), description: form.description.trim() || undefined, sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : undefined, isActive: form.isActive };
    const res = editId ? await adminPackageService.update(editId, data) : await adminPackageService.create(data);
    if (res.error) setActionMsg({ text: res.error.message, type: 'error' });
    else { setActionMsg({ text: editId ? 'Package updated.' : 'Package created.', type: 'success' }); setEditId(null); setShowCreate(false); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete or deactivate this package?')) return;
    const res = await adminPackageService.remove(id);
    if (res.error) setActionMsg({ text: res.error.message, type: 'error' });
    else { setActionMsg({ text: (res.data as { message?: string } | null)?.message ?? 'Package removed.', type: 'success' }); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={startCreate}>+ New Package</Button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded accent-fizza-secondary" />
            Show inactive
          </label>
        </div>
        {actionMsg && (
          <Alert variant={actionMsg.type} className="flex-1" onClose={() => setActionMsg(null)}>{actionMsg.text}</Alert>
        )}
      </div>

      {(showCreate || editId) && (
        <Card className="border-fizza-secondary/30 bg-emerald-50/20">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">{editId ? 'Edit Package' : 'New Package'}</h4>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <FormField label="Name *">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Monthly Standard" />
            </FormField>
            <FormField label="Billing Cycle *">
              <Input value={form.billingCycle} onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))} placeholder="monthly" />
            </FormField>
            <FormField label="Price (SAR) *">
              <Input type="number" min="0" step="0.01" value={form.priceSar} onChange={(e) => setForm((f) => ({ ...f, priceSar: e.target.value }))} placeholder="299.00" />
            </FormField>
            <FormField label="Sort Order">
              <Input type="number" step="1" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} placeholder="1" />
            </FormField>
          </div>
          <div className="mb-4">
            <FormField label="Description">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description shown to users" />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-4">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-fizza-secondary" />
            Active (visible to users)
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave}>{editId ? 'Save Changes' : 'Create Package'}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setEditId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? <LoadingState message="Loading packages…" /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <div className="space-y-3">
          {packages.length === 0 && <p className="text-gray-400 text-sm">No packages found.</p>}
          {packages.map((pkg) => (
            <Card key={pkg.id} className={pkg.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{pkg.name}</span>
                    <Badge variant="info" className="text-[10px]">{pkg.billingCycle}</Badge>
                    <span className="font-semibold text-fizza-primary text-sm">SAR {Number(pkg.priceSar).toFixed(2)}</span>
                    {!pkg.isActive && <Badge variant="danger" className="text-[10px]">Inactive</Badge>}
                    {pkg.sortOrder != null && <span className="text-xs text-gray-400">order: {pkg.sortOrder}</span>}
                  </div>
                  {pkg.description && <p className="text-sm text-gray-500 mb-1">{pkg.description}</p>}
                  {pkg._count && <p className="text-xs text-gray-400">{pkg._count.userSubscriptions} subscription(s)</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(pkg)}>Edit</Button>
                  <Button variant="danger-outline" size="sm" onClick={() => handleDelete(pkg.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AddOnsTab ────────────────────────────────────────────────────────────────

type AddOnForm = { name: string; priceSar: string; description: string; sortOrder: string; isActive: boolean };

function AddOnsTab() {
  const [addOns, setAddOns]         = useState<AddOn[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionMsg, setActionMsg]   = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const EMPTY: AddOnForm = { name: '', priceSar: '', description: '', sortOrder: '', isActive: true };
  const [form, setForm] = useState<AddOnForm>(EMPTY);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminAddOnService.list(showInactive).then((res) => {
      if (res.error) setError(res.error.message);
      else setAddOns((res.data as AddOn[]) ?? []);
      setLoading(false);
    });
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (a: AddOn) => {
    setEditId(a.id); setShowCreate(false);
    setForm({ name: a.name, priceSar: String(a.priceSar), description: a.description ?? '', sortOrder: a.sortOrder != null ? String(a.sortOrder) : '', isActive: a.isActive });
  };

  const startCreate = () => { setEditId(null); setShowCreate(true); setForm(EMPTY); };

  const handleSave = async () => {
    const data = { name: form.name.trim(), priceSar: parseFloat(form.priceSar), description: form.description.trim() || undefined, sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : undefined, isActive: form.isActive };
    const res = editId ? await adminAddOnService.update(editId, data) : await adminAddOnService.create(data);
    if (res.error) setActionMsg({ text: res.error.message, type: 'error' });
    else { setActionMsg({ text: editId ? 'Add-on updated.' : 'Add-on created.', type: 'success' }); setEditId(null); setShowCreate(false); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete or deactivate this add-on?')) return;
    const res = await adminAddOnService.remove(id);
    if (res.error) setActionMsg({ text: res.error.message, type: 'error' });
    else { setActionMsg({ text: (res.data as { message?: string } | null)?.message ?? 'Add-on removed.', type: 'success' }); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={startCreate}>+ New Add-on</Button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded accent-fizza-secondary" />
            Show inactive
          </label>
        </div>
        {actionMsg && (
          <Alert variant={actionMsg.type} className="flex-1" onClose={() => setActionMsg(null)}>{actionMsg.text}</Alert>
        )}
      </div>

      {(showCreate || editId) && (
        <Card className="border-fizza-secondary/30 bg-emerald-50/20">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">{editId ? 'Edit Add-on' : 'New Add-on'}</h4>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <FormField label="Name *">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="GPS Tracking" />
            </FormField>
            <FormField label="Price (SAR) *">
              <Input type="number" min="0" step="0.01" value={form.priceSar} onChange={(e) => setForm((f) => ({ ...f, priceSar: e.target.value }))} placeholder="29.00" />
            </FormField>
            <FormField label="Sort Order">
              <Input type="number" step="1" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} placeholder="1" />
            </FormField>
          </div>
          <div className="mb-4">
            <FormField label="Description">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-4">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-fizza-secondary" />
            Active (visible to users)
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave}>{editId ? 'Save Changes' : 'Create Add-on'}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setEditId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? <LoadingState message="Loading add-ons…" /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <div className="space-y-3">
          {addOns.length === 0 && <p className="text-gray-400 text-sm">No add-ons found.</p>}
          {addOns.map((a) => (
            <Card key={a.id} className={a.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{a.name}</span>
                    <span className="font-semibold text-fizza-primary text-sm">SAR {Number(a.priceSar).toFixed(2)}</span>
                    {!a.isActive && <Badge variant="danger" className="text-[10px]">Inactive</Badge>}
                    {a.sortOrder != null && <span className="text-xs text-gray-400">order: {a.sortOrder}</span>}
                  </div>
                  {a.description && <p className="text-sm text-gray-500 mb-1">{a.description}</p>}
                  {a._count && <p className="text-xs text-gray-400">{a._count.subscriptionAddOns} subscription(s)</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>Edit</Button>
                  <Button variant="danger-outline" size="sm" onClick={() => handleDelete(a.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
