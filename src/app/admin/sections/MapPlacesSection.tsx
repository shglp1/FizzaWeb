'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, MapPin } from 'lucide-react';
import type { MapPlaceType } from '@prisma/client';
import { adminMapPlaceService, adminMapLocationReviewService } from '@/services/adminService';
import { Alert, Button, Input, Textarea } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminTable,
  AdminStatusBadge,
  AdminEmptyState,
  AdminSectionLoading,
  AdminDrawer,
  AdminFilterSelect,
  AdminDataCard,
  AdminMetaItem,
} from '@/components/admin/AdminUI';
import { MAP_PLACE_TYPES, mapPlaceTypeLabel } from '@/lib/maps/mapPlaceTypes';

type MapPlaceRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  type: MapPlaceType;
  city: string;
  region: string | null;
  latitude: string | number;
  longitude: string | number;
  aliasesAr: unknown;
  aliasesEn: unknown;
  isActive: boolean;
  isVerified: boolean;
  notes: string | null;
};

type FormState = {
  nameAr: string;
  nameEn: string;
  type: MapPlaceType;
  city: string;
  region: string;
  latitude: string;
  longitude: string;
  aliasesAr: string;
  aliasesEn: string;
  isActive: boolean;
  isVerified: boolean;
  notes: string;
};

const EMPTY: FormState = {
  nameAr: '',
  nameEn: '',
  type: 'LANDMARK',
  city: '',
  region: '',
  latitude: '',
  longitude: '',
  aliasesAr: '',
  aliasesEn: '',
  isActive: true,
  isVerified: false,
  notes: '',
};

function aliasesToString(v: unknown): string {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(', ');
  return '';
}

function aliasesFromString(v: string): string[] {
  return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

type ListResponse = {
  items: MapPlaceRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  stats?: { total: number; verified: number; inactive: number; cities: number };
};

type ReviewRow = {
  id: string;
  label: string;
  locationKind: string;
  city?: string;
  latitude: string | number;
  longitude: string | number;
  source: string;
  confidence: string;
  status: string;
};

export function MapPlacesSection() {
  const [places, setPlaces] = useState<MapPlaceRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, verified: 0, inactive: 0, cities: 0 });
  const [pendingReviews, setPendingReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminMapPlaceService
      .list({
        q: search || undefined,
        city: cityFilter || undefined,
        type: typeFilter || undefined,
        active: activeFilter || undefined,
        page,
        limit: 25,
      })
      .then((res) => {
        if (res.error) setError(res.error.message);
        else {
          const data = res.data as ListResponse;
          setPlaces(data?.items ?? []);
          setTotalPages(data?.pages ?? 1);
          if (data?.stats) setStats(data.stats);
        }
        setLoading(false);
      });
    adminMapLocationReviewService.list({ status: 'PENDING', limit: 10 }).then((res) => {
      if (res.data) {
        const d = res.data as { items?: ReviewRow[] };
        setPendingReviews(d.items ?? []);
      }
    });
  }, [search, cityFilter, typeFilter, activeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => stats, [stats]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDrawerOpen(true);
    setError('');
  };

  const openEdit = (p: MapPlaceRow) => {
    setEditingId(p.id);
    setForm({
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      type: p.type,
      city: p.city,
      region: p.region ?? '',
      latitude: String(p.latitude),
      longitude: String(p.longitude),
      aliasesAr: aliasesToString(p.aliasesAr),
      aliasesEn: aliasesToString(p.aliasesEn),
      isActive: p.isActive,
      isVerified: p.isVerified,
      notes: p.notes ?? '',
    });
    setDrawerOpen(true);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim(),
      type: form.type,
      city: form.city.trim(),
      region: form.region.trim() || null,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      aliasesAr: aliasesFromString(form.aliasesAr),
      aliasesEn: aliasesFromString(form.aliasesEn),
      isActive: form.isActive,
      isVerified: form.isVerified,
      notes: form.notes.trim() || null,
    };
    const res = editingId
      ? await adminMapPlaceService.update(editingId, payload)
      : await adminMapPlaceService.create(payload);
    setSaving(false);
    if (res.error) setError(res.error.message);
    else {
      setMsg(editingId ? 'Place updated' : 'Place created');
      setDrawerOpen(false);
      load();
    }
  };

  const copyCoords = async (p: MapPlaceRow) => {
    const text = `${Number(p.latitude).toFixed(6)}, ${Number(p.longitude).toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Coordinates copied');
    } catch {
      setError('Could not copy coordinates');
    }
  };

  if (loading) return <AdminSectionLoading message="Loading map places…" />;

  return (
    <div className="space-y-6 min-w-0">
      <AdminSectionHeader
        title="Map Places"
        subtitle="Local Saudi location registry — improves parent search accuracy beyond OSM data."
        count={kpis.total}
        countLabel="places"
        primaryAction={
          <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">
            Add place
          </Button>
        }
      />

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
      {msg && <Alert variant="success" onClose={() => setMsg('')}>{msg}</Alert>}

      <AdminMetricGrid
        columns={4}
        items={[
          { label: 'Total places', value: kpis.total, icon: MapPin, color: '#059669' },
          { label: 'Verified', value: kpis.verified, color: '#2563EB' },
          { label: 'Inactive', value: kpis.inactive, color: '#9CA3AF' },
          { label: 'Cities covered', value: kpis.cities, color: '#6366F1' },
        ]}
      />

      {pendingReviews.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-950">Unverified locations from subscriptions</h3>
          <ul className="space-y-2">
            {pendingReviews.map((r) => (
              <li key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-white border border-amber-100 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">{r.label}</p>
                  <p className="text-xs text-gray-500">
                    {r.locationKind} · {r.source} · {r.confidence} · {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void adminMapLocationReviewService.ignore(r.id).then(() => load())}
                  >
                    Ignore
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      void adminMapLocationReviewService
                        .convert(r.id, { label: r.label, type: 'LANDMARK', city: 'Unknown' })
                        .then(() => load())
                    }
                  >
                    Save as verified place
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or alias…"
        filters={[
          {
            id: 'mp-city',
            label: 'City',
            element: (
              <Input id="mp-city" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} placeholder="Medina" />
            ),
          },
          {
            id: 'mp-type',
            label: 'Type',
            element: (
              <AdminFilterSelect
                id="mp-type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[{ value: '', label: 'All types' }, ...MAP_PLACE_TYPES.map((t) => ({ value: t, label: mapPlaceTypeLabel(t) }))]}
              />
            ),
          },
          {
            id: 'mp-active',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="mp-active"
                value={activeFilter}
                onChange={setActiveFilter}
                options={[
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
              />
            ),
          },
        ]}
      />

      {places.length === 0 ? (
        <AdminEmptyState
          icon={MapPin}
          title="No map places yet"
          description="Add verified Saudi neighborhoods, schools, and landmarks for reliable parent search."
          action={<Button variant="primary" onClick={openCreate}>Add place</Button>}
        />
      ) : (
        <AdminTable
          rows={places}
          columns={[
            { key: 'ar', header: 'Arabic', cell: (r) => r.nameAr },
            { key: 'en', header: 'English', cell: (r) => r.nameEn },
            { key: 'type', header: 'Type', cell: (r) => mapPlaceTypeLabel(r.type) },
            { key: 'loc', header: 'City', cell: (r) => `${r.city}${r.region ? `, ${r.region}` : ''}` },
            {
              key: 'coords',
              header: 'Coordinates',
              cell: (r) => `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`,
            },
            {
              key: 'badges',
              header: 'Status',
              cell: (r) => (
                <div className="flex flex-wrap gap-1">
                  {r.isVerified && <AdminStatusBadge status="ACTIVE" label="Verified" />}
                  <AdminStatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
              ),
            },
          ]}
          rowActions={(r) => (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => void copyCoords(r)} className="gap-1">
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
              </Button>
            </div>
          )}
          mobileCard={(r) => (
            <AdminDataCard
              title={r.nameEn}
              subtitle={r.nameAr}
              badges={
                <>
                  {r.isVerified && <AdminStatusBadge status="ACTIVE" label="Verified" />}
                  <AdminStatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </>
              }
              metadata={
                <>
                  <AdminMetaItem label="Type" value={mapPlaceTypeLabel(r.type)} />
                  <AdminMetaItem label="City" value={r.city} />
                  <AdminMetaItem label="Coords" value={`${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`} />
                </>
              }
              actions={
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => void copyCoords(r)}>Copy</Button>
                </div>
              }
              compact
            />
          )}
        />
      )}

      {places.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-xs text-gray-600">Page {page} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit place' : 'Add place'}
        subtitle="Names and coordinates appear in parent subscription search."
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Arabic name" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          <Input label="English name" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          <Input label="Aliases (Arabic)" value={form.aliasesAr} onChange={(e) => setForm({ ...form, aliasesAr: e.target.value })} helpText="Comma-separated" />
          <Input label="Aliases (English)" value={form.aliasesEn} onChange={(e) => setForm({ ...form, aliasesEn: e.target.value })} helpText="Comma-separated" />
          <AdminFilterSelect
            id="mp-form-type"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as MapPlaceType })}
            options={MAP_PLACE_TYPES.map((t) => ({ value: t, label: mapPlaceTypeLabel(t) }))}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm min-h-[44px]">
            <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} className="rounded accent-emerald-600" />
            Verified place
          </label>
          <label className="flex items-center gap-2 text-sm min-h-[44px]">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded accent-emerald-600" />
            Active
          </label>
          <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </AdminDrawer>
    </div>
  );
}
