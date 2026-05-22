'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminPackageService, adminAddOnService } from '@/services/adminService';

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

// ─── PackagesSection ──────────────────────────────────────────────────────────

export function PackagesSection() {
  const [tab, setTab] = useState<ActiveTab>('packages');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('packages')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'packages'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Subscription Packages
        </button>
        <button
          onClick={() => setTab('addons')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'addons'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Add-ons
        </button>
      </div>

      {tab === 'packages' ? <PackagesTab /> : <AddOnsTab />}
    </div>
  );
}

// ─── PackagesTab ──────────────────────────────────────────────────────────────

function PackagesTab() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '', billingCycle: '', priceSar: '', description: '', sortOrder: '', isActive: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminPackageService.list(showInactive).then((res) => {
      if (res.error) setError(res.error.message);
      else setPackages((res.data as Package[]) ?? []);
      setLoading(false);
    });
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  function startEdit(pkg: Package) {
    setEditId(pkg.id);
    setShowCreate(false);
    setForm({
      name: pkg.name,
      billingCycle: pkg.billingCycle,
      priceSar: String(pkg.priceSar),
      description: pkg.description ?? '',
      sortOrder: pkg.sortOrder != null ? String(pkg.sortOrder) : '',
      isActive: pkg.isActive,
    });
  }

  function startCreate() {
    setEditId(null);
    setShowCreate(true);
    setForm({ name: '', billingCycle: 'monthly', priceSar: '', description: '', sortOrder: '', isActive: true });
  }

  async function handleSave() {
    const data = {
      name: form.name.trim(),
      billingCycle: form.billingCycle.trim(),
      priceSar: parseFloat(form.priceSar),
      description: form.description.trim() || undefined,
      sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : undefined,
      isActive: form.isActive,
    };

    let res;
    if (editId) {
      res = await adminPackageService.update(editId, data);
    } else {
      res = await adminPackageService.create(data);
    }

    if (res.error) {
      setActionMsg(`Error: ${res.error.message}`);
    } else {
      setActionMsg(editId ? 'Package updated.' : 'Package created.');
      setEditId(null);
      setShowCreate(false);
      load();
    }
    setTimeout(() => setActionMsg(''), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete or deactivate this package?')) return;
    const res = await adminPackageService.remove(id);
    if (res.error) {
      setActionMsg(`Error: ${res.error.message}`);
    } else {
      const data = res.data as { message?: string } | null;
      setActionMsg(data?.message ?? 'Package removed.');
      load();
    }
    setTimeout(() => setActionMsg(''), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={startCreate}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
          >
            + New Package
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
        </div>
        {actionMsg && (
          <span className={`text-sm ${actionMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {actionMsg}
          </span>
        )}
      </div>

      {(showCreate || editId) && (
        <PackageForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => { setShowCreate(false); setEditId(null); }}
          isEdit={!!editId}
        />
      )}

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && packages.length === 0 && (
        <p className="text-gray-500 text-sm">No packages found.</p>
      )}

      <div className="space-y-2">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`border rounded-lg p-4 ${pkg.isActive ? 'bg-white' : 'bg-gray-50 opacity-70'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{pkg.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {pkg.billingCycle}
                  </span>
                  <span className="font-semibold text-blue-700">
                    SAR {Number(pkg.priceSar).toFixed(2)}
                  </span>
                  {!pkg.isActive && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                  {pkg.sortOrder != null && (
                    <span className="text-xs text-gray-400">order: {pkg.sortOrder}</span>
                  )}
                </div>
                {pkg.description && (
                  <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                )}
                {pkg._count && (
                  <p className="text-xs text-gray-400 mt-1">
                    {pkg._count.userSubscriptions} subscription(s)
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(pkg)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(pkg.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PackageForm ──────────────────────────────────────────────────────────────

function PackageForm({
  form,
  setForm,
  onSave,
  onCancel,
  isEdit,
}: {
  form: { name: string; billingCycle: string; priceSar: string; description: string; sortOrder: string; isActive: boolean };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
      <h4 className="font-medium text-gray-800">{isEdit ? 'Edit Package' : 'New Package'}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="Monthly Standard"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Billing Cycle *</label>
          <input
            value={form.billingCycle}
            onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="monthly"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Price (SAR) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.priceSar}
            onChange={(e) => setForm((f) => ({ ...f, priceSar: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="299.00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
          <input
            type="number"
            step="1"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="1"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          rows={2}
          placeholder="Optional description shown to users"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          className="rounded"
        />
        Active (visible to users)
      </label>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
        >
          {isEdit ? 'Save Changes' : 'Create Package'}
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── AddOnsTab ────────────────────────────────────────────────────────────────

function AddOnsTab() {
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const [form, setForm] = useState({
    name: '', priceSar: '', description: '', sortOrder: '', isActive: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminAddOnService.list(showInactive).then((res) => {
      if (res.error) setError(res.error.message);
      else setAddOns((res.data as AddOn[]) ?? []);
      setLoading(false);
    });
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  function startEdit(addOn: AddOn) {
    setEditId(addOn.id);
    setShowCreate(false);
    setForm({
      name: addOn.name,
      priceSar: String(addOn.priceSar),
      description: addOn.description ?? '',
      sortOrder: addOn.sortOrder != null ? String(addOn.sortOrder) : '',
      isActive: addOn.isActive,
    });
  }

  function startCreate() {
    setEditId(null);
    setShowCreate(true);
    setForm({ name: '', priceSar: '', description: '', sortOrder: '', isActive: true });
  }

  async function handleSave() {
    const data = {
      name: form.name.trim(),
      priceSar: parseFloat(form.priceSar),
      description: form.description.trim() || undefined,
      sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : undefined,
      isActive: form.isActive,
    };

    let res;
    if (editId) {
      res = await adminAddOnService.update(editId, data);
    } else {
      res = await adminAddOnService.create(data);
    }

    if (res.error) {
      setActionMsg(`Error: ${res.error.message}`);
    } else {
      setActionMsg(editId ? 'Add-on updated.' : 'Add-on created.');
      setEditId(null);
      setShowCreate(false);
      load();
    }
    setTimeout(() => setActionMsg(''), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete or deactivate this add-on?')) return;
    const res = await adminAddOnService.remove(id);
    if (res.error) {
      setActionMsg(`Error: ${res.error.message}`);
    } else {
      const data = res.data as { message?: string } | null;
      setActionMsg(data?.message ?? 'Add-on removed.');
      load();
    }
    setTimeout(() => setActionMsg(''), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={startCreate}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
          >
            + New Add-on
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
        </div>
        {actionMsg && (
          <span className={`text-sm ${actionMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {actionMsg}
          </span>
        )}
      </div>

      {(showCreate || editId) && (
        <AddOnForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => { setShowCreate(false); setEditId(null); }}
          isEdit={!!editId}
        />
      )}

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && addOns.length === 0 && (
        <p className="text-gray-500 text-sm">No add-ons found.</p>
      )}

      <div className="space-y-2">
        {addOns.map((a) => (
          <div
            key={a.id}
            className={`border rounded-lg p-4 ${a.isActive ? 'bg-white' : 'bg-gray-50 opacity-70'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{a.name}</span>
                  <span className="font-semibold text-blue-700">
                    SAR {Number(a.priceSar).toFixed(2)}
                  </span>
                  {!a.isActive && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                  {a.sortOrder != null && (
                    <span className="text-xs text-gray-400">order: {a.sortOrder}</span>
                  )}
                </div>
                {a.description && (
                  <p className="text-sm text-gray-500 mt-1">{a.description}</p>
                )}
                {a._count && (
                  <p className="text-xs text-gray-400 mt-1">
                    {a._count.subscriptionAddOns} subscription(s)
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(a)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AddOnForm ────────────────────────────────────────────────────────────────

function AddOnForm({
  form,
  setForm,
  onSave,
  onCancel,
  isEdit,
}: {
  form: { name: string; priceSar: string; description: string; sortOrder: string; isActive: boolean };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
      <h4 className="font-medium text-gray-800">{isEdit ? 'Edit Add-on' : 'New Add-on'}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="GPS Tracking"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Price (SAR) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.priceSar}
            onChange={(e) => setForm((f) => ({ ...f, priceSar: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="29.00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
          <input
            type="number"
            step="1"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="1"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          rows={2}
          placeholder="Optional description shown to users"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          className="rounded"
        />
        Active (visible to users)
      </label>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
        >
          {isEdit ? 'Save Changes' : 'Create Add-on'}
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
