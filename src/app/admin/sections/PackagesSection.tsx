'use client';

import { Package as PackageIcon, Puzzle, Tag } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminPackageService, adminAddOnService } from '@/services/adminService';
import { Button, Alert, Input, Textarea, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  clientPaginationMeta,
  DEFAULT_ADMIN_PAGE_LIMIT,
  paginateClientList,
} from '@/lib/ui/adminPagination';
import {
  AdminSectionHeader,
  AdminTabs,
  AdminToolbar,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';
import { formatSar } from '@/lib/ui/adminCurrency';
import { PromoCodesPanel } from './PromoCodesPanel';

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

type ActiveTab = 'packages' | 'addons' | 'promos';

export function PackagesSection() {
  const [tab, setTab] = useState<ActiveTab>('packages');
  const [packages, setPackages] = useState<Package[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);

  const currentItems = tab === 'packages' ? packages : addOns;
  const pagedPackages = paginateClientList(packages, tab === 'packages' ? page : 1, limit);
  const pagedAddOns = paginateClientList(addOns, tab === 'addons' ? page : 1, limit);
  const pageMeta = clientPaginationMeta(currentItems.length, page, limit);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      adminPackageService.list(showInactive),
      adminAddOnService.list(showInactive),
    ]).then(([pkgRes, addonRes]) => {
      if (pkgRes.error) setError(pkgRes.error.message);
      else setPackages((pkgRes.data as Package[]) ?? []);
      if (addonRes.data) setAddOns((addonRes.data as AddOn[]) ?? []);
      setLoading(false);
    });
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const activePackages = packages.filter((p) => p.isActive).length;
  const activeAddons = addOns.filter((a) => a.isActive).length;
  const inactiveCount = packages.filter((p) => !p.isActive).length + addOns.filter((a) => !a.isActive).length;

  return (
    <div>
      <AdminSectionHeader
        title="Packages & Add-ons"
        subtitle="Subscription products and optional add-on catalog"
        count={tab === 'packages' ? packages.length : addOns.length}
        countLabel={tab === 'packages' ? 'packages' : 'add-ons'}
        primaryAction={
          tab === 'promos' ? undefined : (
          <Button variant="primary" size="sm" onClick={() => { setShowCreate(true); setEditId(null); }} className="min-h-[44px]">
            + New {tab === 'packages' ? 'Package' : 'Add-on'}
          </Button>
          )
        }
      />

      <AdminMetricGrid
        columns={3}
        items={[
          { label: 'Active Packages', value: activePackages, icon: PackageIcon, color: '#059669' },
          { label: 'Active Add-ons', value: activeAddons, icon: Puzzle, color: '#6366F1' },
          { label: 'Inactive Items', value: inactiveCount, color: '#9CA3AF' },
        ]}
      />

      <AdminTabs
        tabs={[
          { label: 'Packages', value: 'packages', count: packages.length },
          { label: 'Add-ons', value: 'addons', count: addOns.length },
          { label: 'Promo codes', value: 'promos' },
        ]}
        active={tab}
        onChange={(v) => { setTab(v as ActiveTab); setShowCreate(false); setEditId(null); setPage(1); }}
      />

      {tab === 'promos' ? (
        <PromoCodesPanel />
      ) : (
      <>
      <AdminToolbar
        actions={
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded accent-fizza-secondary" />
            Show inactive
          </label>
        }
      />

      {actionMsg && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>{actionMsg.text}</Alert>
      )}

      {tab === 'packages' ? (
        <PackagesTab
          packages={pagedPackages}
          loading={loading}
          error={error}
          showCreate={showCreate}
          editId={editId}
          setShowCreate={setShowCreate}
          setEditId={setEditId}
          onReload={load}
          onMessage={setActionMsg}
        />
      ) : (
        <AddOnsTab
          addOns={pagedAddOns}
          loading={loading}
          showCreate={showCreate}
          editId={editId}
          setShowCreate={setShowCreate}
          setEditId={setEditId}
          onReload={load}
          onMessage={setActionMsg}
        />
      )}

      {currentItems.length > 0 && (
        <AdminPagination
          meta={pageMeta}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          className="mt-5"
        />
      )}
      </>
      )}
    </div>
  );
}

type PkgForm = { name: string; billingCycle: string; priceSar: string; description: string; sortOrder: string; isActive: boolean };
const EMPTY_PKG: PkgForm = { name: '', billingCycle: 'monthly', priceSar: '', description: '', sortOrder: '', isActive: true };

function PackagesTab({
  packages, loading, error, showCreate, editId, setShowCreate, setEditId, onReload, onMessage,
}: {
  packages: Package[]; loading: boolean; error: string; showCreate: boolean; editId: string | null;
  setShowCreate: (v: boolean) => void; setEditId: (v: string | null) => void;
  onReload: () => void; onMessage: (m: { text: string; type: 'success' | 'error' }) => void;
}) {
  const [form, setForm] = useState<PkgForm>(EMPTY_PKG);

  const startEdit = (pkg: Package) => {
    setEditId(pkg.id); setShowCreate(false);
    setForm({ name: pkg.name, billingCycle: pkg.billingCycle, priceSar: String(pkg.priceSar), description: pkg.description ?? '', sortOrder: pkg.sortOrder != null ? String(pkg.sortOrder) : '', isActive: pkg.isActive });
  };

  const handleSave = async () => {
    const data = { name: form.name.trim(), billingCycle: form.billingCycle.trim(), priceSar: parseFloat(form.priceSar), description: form.description.trim() || undefined, sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : undefined, isActive: form.isActive };
    const res = editId ? await adminPackageService.update(editId, data) : await adminPackageService.create(data);
    if (res.error) onMessage({ text: res.error.message, type: 'error' });
    else { onMessage({ text: editId ? 'Package updated.' : 'Package created.', type: 'success' }); setEditId(null); setShowCreate(false); onReload(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate or delete this package? Items with active subscriptions will be deactivated instead of hard deleted.')) return;
    const res = await adminPackageService.remove(id);
    if (res.error) onMessage({ text: res.error.message, type: 'error' });
    else { onMessage({ text: (res.data as { message?: string } | null)?.message ?? 'Package removed.', type: 'success' }); onReload(); }
  };

  if (loading) return <AdminSectionLoading message="Loading packages…" />;
  if (error) return <ErrorState message={error} onRetry={onReload} />;

  return (
    <div className="space-y-4">
      {(showCreate || editId) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-card">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">{editId ? 'Edit Package' : 'New Package'}</h4>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <FormField label="Name *"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Monthly Standard" /></FormField>
            <FormField label="Billing Cycle *"><Input value={form.billingCycle} onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))} placeholder="monthly" /></FormField>
            <FormField label="Price (SAR) *"><Input type="number" min="0" step="0.01" value={form.priceSar} onChange={(e) => setForm((f) => ({ ...f, priceSar: e.target.value }))} /></FormField>
            <FormField label="Sort Order"><Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} /></FormField>
          </div>
          <FormField label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></FormField>
          <label className="flex items-center gap-2 text-sm mt-3 mb-4 min-h-[44px]">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-fizza-secondary" />
            Active (visible to users)
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} className="min-h-[44px]">{editId ? 'Save' : 'Create'}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setEditId(null); }} className="min-h-[44px]">Cancel</Button>
          </div>
        </div>
      )}

      {packages.length === 0 ? (
        <AdminEmptyState icon={PackageIcon} title="No packages" description="Create your first subscription package." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((pkg) => (
            <AdminDataCard
              key={pkg.id}
              title={pkg.name}
              subtitle={pkg.description ?? undefined}
              badges={
                <>
                  <AdminStatusBadge status={pkg.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <span className="text-xs font-semibold text-fizza-primary">{formatSar(pkg.priceSar)}</span>
                </>
              }
              metadata={
                <>
                  <AdminMetaItem label="Billing" value={pkg.billingCycle} />
                  <AdminMetaItem label="Subscriptions" value={pkg._count?.userSubscriptions ?? 0} />
                  <AdminMetaItem label="Sort order" value={pkg.sortOrder ?? '—'} />
                </>
              }
              actions={
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(pkg)} className="min-h-[44px]">Edit</Button>
                  <Button variant="danger-outline" size="sm" onClick={() => handleDelete(pkg.id)} className="min-h-[44px]">Delete</Button>
                </>
              }
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

type AddOnForm = { name: string; priceSar: string; description: string; sortOrder: string; isActive: boolean };
const EMPTY_ADDON: AddOnForm = { name: '', priceSar: '', description: '', sortOrder: '', isActive: true };

function AddOnsTab({
  addOns, loading, showCreate, editId, setShowCreate, setEditId, onReload, onMessage,
}: {
  addOns: AddOn[]; loading: boolean; showCreate: boolean; editId: string | null;
  setShowCreate: (v: boolean) => void; setEditId: (v: string | null) => void;
  onReload: () => void; onMessage: (m: { text: string; type: 'success' | 'error' }) => void;
}) {
  const [form, setForm] = useState<AddOnForm>(EMPTY_ADDON);

  const startEdit = (a: AddOn) => {
    setEditId(a.id); setShowCreate(false);
    setForm({ name: a.name, priceSar: String(a.priceSar), description: a.description ?? '', sortOrder: a.sortOrder != null ? String(a.sortOrder) : '', isActive: a.isActive });
  };

  const handleSave = async () => {
    const data = { name: form.name.trim(), priceSar: parseFloat(form.priceSar), description: form.description.trim() || undefined, sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : undefined, isActive: form.isActive };
    const res = editId ? await adminAddOnService.update(editId, data) : await adminAddOnService.create(data);
    if (res.error) onMessage({ text: res.error.message, type: 'error' });
    else { onMessage({ text: editId ? 'Add-on updated.' : 'Add-on created.', type: 'success' }); setEditId(null); setShowCreate(false); onReload(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate or delete this add-on?')) return;
    const res = await adminAddOnService.remove(id);
    if (res.error) onMessage({ text: res.error.message, type: 'error' });
    else { onMessage({ text: (res.data as { message?: string } | null)?.message ?? 'Add-on removed.', type: 'success' }); onReload(); }
  };

  if (loading) return <AdminSectionLoading message="Loading add-ons…" />;

  return (
    <div className="space-y-4">
      {(showCreate || editId) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-card">
          <h4 className="text-sm font-semibold mb-4">{editId ? 'Edit Add-on' : 'New Add-on'}</h4>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <FormField label="Name *"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></FormField>
            <FormField label="Price (SAR) *"><Input type="number" min="0" step="0.01" value={form.priceSar} onChange={(e) => setForm((f) => ({ ...f, priceSar: e.target.value }))} /></FormField>
          </div>
          <FormField label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></FormField>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" size="sm" onClick={handleSave} className="min-h-[44px]">Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setEditId(null); }} className="min-h-[44px]">Cancel</Button>
          </div>
        </div>
      )}

      {addOns.length === 0 ? (
        <AdminEmptyState icon={Puzzle} title="No add-ons" description="Create optional add-ons for subscriptions." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addOns.map((a) => (
            <AdminDataCard
              key={a.id}
              title={a.name}
              subtitle={a.description ?? undefined}
              badges={<><AdminStatusBadge status={a.isActive ? 'ACTIVE' : 'INACTIVE'} /><span className="text-xs font-semibold text-fizza-primary">{formatSar(a.priceSar)}</span></>}
              metadata={<AdminMetaItem label="Active usage" value={a._count?.subscriptionAddOns ?? 0} />}
              actions={<><Button variant="ghost" size="sm" onClick={() => startEdit(a)}>Edit</Button><Button variant="danger-outline" size="sm" onClick={() => handleDelete(a.id)}>Delete</Button></>}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
