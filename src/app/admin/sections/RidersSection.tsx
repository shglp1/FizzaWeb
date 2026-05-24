'use client';

import { Users, Heart, School, Bus } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminRiderService } from '@/services/adminService';
import { Button, Alert, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminFilterSelect,
  AdminSectionLoading,
  AdminAvatar,
  useDebouncedValue,
} from '@/components/admin/AdminUI';
import { ConfirmDialog } from '@/components/ui';

type RiderRow = {
  id: string;
  name: string;
  relationship: string;
  school: string | null;
  grade: string | null;
  specialNeeds: boolean;
  isActive: boolean;
  createdAt: string;
  parent: { id: string; fullName: string; phone: string | null; user: { email: string } };
  _count: { subscriptions: number; trips: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function RidersSection() {
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [activeFilter, setActiveFilter] = useState('');
  const [specialFilter, setSpecialFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<RiderRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<RiderRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleMsg, setToggleMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback((s: string, a: string, p: number, l: number) => {
    setLoading(true);
    setError('');
    const isActive = a === 'true' ? true : a === 'false' ? false : undefined;
    adminRiderService.list({ search: s || undefined, isActive, page: p, limit: l }).then((res) => {
      if (res.data) {
        setRiders((res.data as { riders: RiderRow[]; meta: Meta }).riders ?? []);
        setMeta((res.data as { riders: RiderRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load riders.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(debouncedSearch, activeFilter, page, limit); }, [debouncedSearch, activeFilter, page, limit, load]);

  useEffect(() => {
    adminRiderService.list({ isActive: true, page: 1 }).then((res) => {
      if (res.data) setActiveCount((res.data as { meta: Meta }).meta.total);
    });
  }, []);

  const filteredRiders = specialFilter === 'special'
    ? riders.filter((r) => r.specialNeeds)
    : specialFilter === 'subscriptions'
    ? riders.filter((r) => r._count.subscriptions > 0)
    : riders;

  const specialCount = riders.filter((r) => r.specialNeeds).length;
  const withSubsCount = riders.filter((r) => r._count.subscriptions > 0).length;

  const toggleActive = async (rider: RiderRow) => {
    setTogglingId(rider.id);
    setToggleMsg(null);
    const res = await adminRiderService.update(rider.id, { isActive: !rider.isActive });
    setTogglingId(null);
    setConfirmDeactivate(null);
    if (res.data) {
      setToggleMsg({ text: `${rider.name} ${!rider.isActive ? 'activated' : 'deactivated'}.`, type: 'success' });
      setSelected(null);
      load(debouncedSearch, activeFilter, page, limit);
    } else {
      setToggleMsg({ text: res.error?.message ?? 'Update failed.', type: 'error' });
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setActiveFilter('');
    setSpecialFilter('');
    setPage(1);
  };

  return (
    <div>
      <AdminSectionHeader
        title="Riders"
        subtitle="Student profiles, parent links, and subscription activity"
        count={meta?.total}
        countLabel="riders"
      />

      <AdminMetricGrid
        columns={4}
        items={[
          { label: 'Total Riders', value: meta?.total ?? '—', icon: Users },
          { label: 'Active', value: activeCount ?? '—', color: '#059669' },
          { label: 'Special Needs', value: specialCount, icon: Heart, color: '#D97706', helper: 'On current page' },
          { label: 'With Subscriptions', value: withSubsCount, icon: Bus, color: '#6366F1', helper: 'On current page' },
        ]}
      />

      <AdminToolbar
        search={searchInput}
        onSearchChange={(v) => { setSearchInput(v); setPage(1); }}
        searchPlaceholder="Search by name or school…"
        filters={[
          {
            id: 'rider-status',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="rider-status"
                value={activeFilter}
                onChange={(v) => { setActiveFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All riders' },
                  { value: 'true', label: 'Active only' },
                  { value: 'false', label: 'Inactive only' },
                ]}
              />
            ),
          },
          {
            id: 'rider-special',
            label: 'Special needs',
            element: (
              <AdminFilterSelect
                id="rider-special"
                value={specialFilter}
                onChange={setSpecialFilter}
                options={[
                  { value: '', label: 'All' },
                  { value: 'special', label: 'Special needs' },
                  { value: 'subscriptions', label: 'Has subscriptions' },
                ]}
              />
            ),
          },
        ]}
        activeChips={[
          ...(debouncedSearch ? [{ label: `"${debouncedSearch}"`, onRemove: () => { setSearchInput(''); setPage(1); } }] : []),
          ...(activeFilter ? [{ label: activeFilter === 'true' ? 'Active' : 'Inactive', onRemove: () => { setActiveFilter(''); setPage(1); } }] : []),
        ]}
        onReset={resetFilters}
      />

      {toggleMsg && (
        <Alert variant={toggleMsg.type} className="mb-4" onClose={() => setToggleMsg(null)}>{toggleMsg.text}</Alert>
      )}

      {loading ? (
        <AdminSectionLoading message="Loading riders…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(debouncedSearch, activeFilter, page, limit)} />
      ) : filteredRiders.length === 0 ? (
        <AdminEmptyState
          icon={Users}
          title="No riders found"
          description="Adjust filters or search to find riders."
          action={<Button variant="outline" size="sm" onClick={resetFilters}>Reset filters</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRiders.map((r) => (
            <AdminDataCard
              key={r.id}
              title={r.name}
              subtitle={[r.relationship, r.school, r.grade ? `Grade ${r.grade}` : null].filter(Boolean).join(' · ')}
              badges={
                <>
                  {!r.isActive && <AdminStatusBadge status="INACTIVE" label="Inactive" />}
                  {r.specialNeeds && <AdminStatusBadge status="PENDING" label="Special needs" />}
                </>
              }
              onClick={() => setSelected(r)}
              metadata={
                <>
                  <AdminMetaItem label="Parent" value={r.parent.fullName} />
                  <AdminMetaItem label="Subscriptions" value={r._count.subscriptions} />
                  <AdminMetaItem label="Trips" value={r._count.trips} />
                </>
              }
              compact
            />
          ))}
        </div>
      )}

      {meta && (
        <AdminPagination
          meta={meta}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          className="mt-5"
        />
      )}

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.relationship}${selected.school ? ` · ${selected.school}` : ''}` : undefined}
        footer={
          selected && (
            <Button
              variant={selected.isActive ? 'danger-outline' : 'primary'}
              size="sm"
              loading={togglingId === selected.id}
              onClick={() => selected.isActive ? setConfirmDeactivate(selected) : toggleActive(selected)}
              className="w-full min-h-[44px]"
            >
              {selected.isActive ? 'Deactivate rider' : 'Activate rider'}
            </Button>
          )
        }
      >
        {selected && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <AdminAvatar name={selected.name} colorClass="bg-purple-500" />
              <div>
                <AdminStatusBadge status={selected.isActive ? 'ACTIVE' : 'INACTIVE'} />
                {selected.specialNeeds && (
                  <span className="ml-2"><AdminStatusBadge status="PENDING" label="Special needs" /></span>
                )}
              </div>
            </div>
            <AdminDrawerSection title="Profile">
              <AdminDrawerRow label="Grade" value={selected.grade ?? '—'} />
              <AdminDrawerRow label="School" value={selected.school ?? '—'} />
              <AdminDrawerRow label="Relationship" value={selected.relationship} />
              <AdminDrawerRow label="Joined" value={new Date(selected.createdAt).toLocaleDateString()} />
            </AdminDrawerSection>
            <AdminDrawerSection title="Parent">
              <AdminDrawerRow label="Name" value={selected.parent.fullName} />
              <AdminDrawerRow label="Email" value={selected.parent.user.email} />
              <AdminDrawerRow label="Phone" value={selected.parent.phone ?? '—'} />
            </AdminDrawerSection>
            <AdminDrawerSection title="Activity">
              <AdminDrawerRow label="Active subscriptions" value={selected._count.subscriptions} />
              <AdminDrawerRow label="Total trips" value={selected._count.trips} />
            </AdminDrawerSection>
            {selected.specialNeeds && (
              <AdminDrawerSection title="Safety notes">
                <p className="text-sm text-amber-800">This rider is flagged for special needs. Review trip assignments and driver notes before scheduling changes.</p>
              </AdminDrawerSection>
            )}
          </>
        )}
      </AdminDrawer>

      <ConfirmDialog
        isOpen={!!confirmDeactivate}
        title="Deactivate rider?"
        message={confirmDeactivate ? `${confirmDeactivate.name} will no longer appear in active trip planning.` : ''}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        onConfirm={() => confirmDeactivate && toggleActive(confirmDeactivate)}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
