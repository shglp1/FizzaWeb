'use client';

import { Users, UserRound } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { adminUserService } from '@/services/adminService';
import { Button, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminRowMenu } from '@/components/admin/AdminRowMenu';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminTable,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminFilterSelect,
  AdminSectionLoading,
  AdminLoadingGrid,
  AdminAvatar,
  AdminDataCard,
  AdminMetaItem,
  useDebouncedValue,
} from '@/components/admin/AdminUI';
import { formatWallet } from '@/lib/ui/adminCurrency';
import type { AccountType } from '@/lib/adminUserTypes';

export { formatWallet };

export const ACCOUNT_TYPE_VARIANT = {
  FAMILY_PARENT: 'info',
  DRIVER_APPLICANT: 'warning',
  APPROVED_DRIVER: 'success',
  ADMIN: 'purple',
} as const;

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  FAMILY_PARENT: 'Parent',
  DRIVER_APPLICANT: 'Driver Applicant',
  APPROVED_DRIVER: 'Approved Driver',
  ADMIN: 'Admin',
};

export const APP_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  NEEDS_CHANGES: 'Needs changes',
};

export const APP_STATUS_FILTER_LABEL: Record<string, string> = {
  NOT_SUBMITTED: 'Not Submitted',
  PENDING: 'Pending Review',
  NEEDS_CHANGES: 'Needs Changes',
  REJECTED: 'Rejected',
  APPROVED: 'Approved (Sync Pending)',
};

export const APP_STATUS_HELPER: Record<string, string> = {
  NOT_SUBMITTED: 'Registered through driver portal but application form not submitted yet.',
  PENDING: 'Application submitted and waiting for admin review.',
  NEEDS_CHANGES: 'Admin requested updates to the application.',
  REJECTED: 'Application was rejected.',
  APPROVED: 'Application approved — user session/role may need refresh.',
};

type DriverApp = { id: string; status: string; adminResponse: string | null; updatedAt: string; createdAt: string } | null;

type UserRow = {
  id: string;
  fullName: string;
  role: string;
  phone: string | null;
  registrationSource: string;
  createdAt: string;
  user: { email: string };
  wallet: { balanceSar: string } | null;
  _count: { userSubscriptions: number; riders: number };
  driverApplication: DriverApp;
  accountType: AccountType;
  driverState: string;
  displayRole: string;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };
type Summary = { admins: number; approvedDrivers: number; driverApplicants: number; familyParents: number };

type UserDetail = {
  fullName: string;
  phone: string | null;
  role: string;
  user: { email: string; createdAt: string };
  wallet: { balanceSar: string } | null;
  riders: { id: string; name: string; school: string | null; isActive: boolean; grade: string | null }[];
  userSubscriptions: { id: string; subscriptionType: string; status: string; paymentStatus: string; finalPriceSar: string; createdAt: string }[];
  payments: { id: string; amountSar: string; status: string; purpose: string; createdAt: string }[];
};

export function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name_asc' | 'account_type'>('newest');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback((s: string, at: string, as_: string, p: number, l: number, sortBy: typeof sort) => {
    setLoading(true);
    setError('');
    adminUserService.list({
      search: s || undefined,
      accountType: at || undefined,
      applicationStatus: as_ || undefined,
      sort: sortBy,
      page: p,
      limit: l,
    }).then((res) => {
      if (res.data) {
        const d = res.data as { users: UserRow[]; meta: Meta; summary: Summary };
        setUsers(d.users ?? []);
        setMeta(d.meta ?? null);
        setSummary(d.summary ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load users.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(debouncedSearch, accountTypeFilter, appStatusFilter, page, limit, sort); }, [debouncedSearch, accountTypeFilter, appStatusFilter, page, limit, sort, load]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true);
    adminUserService.get(selected.id).then((res) => {
      if (res.data) setDetail(res.data as UserDetail);
      setDetailLoading(false);
    });
  }, [selected]);

  const handleSummaryClick = (at: AccountType) => {
    const next = accountTypeFilter === at ? '' : at;
    setAccountTypeFilter(next);
    if (next !== 'DRIVER_APPLICANT') setAppStatusFilter('');
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput('');
    setAccountTypeFilter('');
    setAppStatusFilter('');
    setPage(1);
  };

  const hasFilters = !!(debouncedSearch || accountTypeFilter || appStatusFilter);

  const totalUsers = (summary?.familyParents ?? 0) + (summary?.driverApplicants ?? 0) + (summary?.approvedDrivers ?? 0) + (summary?.admins ?? 0);

  return (
    <div>
      <AdminSectionHeader
        title="Users"
        subtitle="Family accounts, driver applicants, approved drivers, and admins"
        count={meta?.total}
        countLabel="users"
      />

      <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
        Driver applicants remain <code className="font-mono bg-gray-100 px-1 rounded">PARENT</code> in auth until approval, but are classified separately here.
      </div>

      {loading && !summary ? (
        <AdminLoadingGrid count={5} />
      ) : (
        <AdminMetricGrid
          columns={5}
          items={[
            { label: 'Total Users', value: meta?.total ?? totalUsers, icon: Users },
            { label: 'Parents', value: summary?.familyParents ?? 0, onClick: () => handleSummaryClick('FAMILY_PARENT'), active: accountTypeFilter === 'FAMILY_PARENT' },
            { label: 'Driver Applicants', value: summary?.driverApplicants ?? 0, onClick: () => handleSummaryClick('DRIVER_APPLICANT'), active: accountTypeFilter === 'DRIVER_APPLICANT', color: '#D97706' },
            { label: 'Approved Drivers', value: summary?.approvedDrivers ?? 0, onClick: () => handleSummaryClick('APPROVED_DRIVER'), active: accountTypeFilter === 'APPROVED_DRIVER', color: '#059669' },
            { label: 'Admins', value: summary?.admins ?? 0, onClick: () => handleSummaryClick('ADMIN'), active: accountTypeFilter === 'ADMIN', color: '#7C3AED' },
          ]}
        />
      )}

      <AdminToolbar
        search={searchInput}
        onSearchChange={(v) => { setSearchInput(v); setPage(1); }}
        searchPlaceholder="Search by name, email, or phone…"
        filters={[
          {
            id: 'account-type',
            label: 'Account type',
            element: (
              <AdminFilterSelect
                id="account-type"
                value={accountTypeFilter}
                onChange={(v) => { setAccountTypeFilter(v); if (v !== 'DRIVER_APPLICANT') setAppStatusFilter(''); setPage(1); }}
                options={[
                  { value: '', label: 'All accounts' },
                  { value: 'FAMILY_PARENT', label: 'Parents' },
                  { value: 'DRIVER_APPLICANT', label: 'Driver applicants' },
                  { value: 'APPROVED_DRIVER', label: 'Approved drivers' },
                  { value: 'ADMIN', label: 'Admins' },
                ]}
              />
            ),
          },
          ...(accountTypeFilter === 'DRIVER_APPLICANT' ? [{
            id: 'app-status',
            label: 'Application',
            element: (
              <AdminFilterSelect
                id="app-status"
                value={appStatusFilter}
                onChange={(v) => { setAppStatusFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All statuses' },
                  ...Object.entries(APP_STATUS_FILTER_LABEL).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            ),
          }] : []),
          {
            id: 'user-sort',
            label: 'Sort',
            element: (
              <AdminFilterSelect
                id="user-sort"
                value={sort}
                onChange={(v) => { setSort(v as typeof sort); setPage(1); }}
                options={[
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'name_asc', label: 'Name A–Z' },
                  { value: 'account_type', label: 'Account type' },
                ]}
              />
            ),
          },
        ]}
        activeChips={[
          ...(debouncedSearch ? [{ label: `"${debouncedSearch}"`, onRemove: () => { setSearchInput(''); setPage(1); } }] : []),
          ...(accountTypeFilter ? [{ label: ACCOUNT_TYPE_LABEL[accountTypeFilter as AccountType] ?? accountTypeFilter, onRemove: () => { setAccountTypeFilter(''); setAppStatusFilter(''); setPage(1); } }] : []),
          ...(appStatusFilter ? [{ label: APP_STATUS_FILTER_LABEL[appStatusFilter] ?? appStatusFilter, onRemove: () => { setAppStatusFilter(''); setPage(1); } }] : []),
        ]}
        onReset={hasFilters ? resetFilters : undefined}
      />

      {loading ? (
        <AdminSectionLoading message="Loading users…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(debouncedSearch, accountTypeFilter, appStatusFilter, page, limit, sort)} />
      ) : users.length === 0 ? (
        <AdminEmptyState
          icon={UserRound}
          title={hasFilters ? 'No users match your filters' : 'No users yet'}
          description={hasFilters ? 'Try adjusting or removing filters.' : 'Users appear here once accounts are created.'}
          action={hasFilters ? <Button variant="outline" size="sm" onClick={resetFilters}>Reset filters</Button> : undefined}
        />
      ) : (
        <AdminTable
          rows={users}
          onRowClick={setSelected}
          columns={[
            {
              key: 'user',
              header: 'User',
              cell: (u) => (
                <div className="flex items-center gap-2.5">
                  <AdminAvatar name={u.fullName} />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{u.fullName}</p>
                    {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                  </div>
                </div>
              ),
            },
            {
              key: 'email',
              header: 'Email',
              cell: (u) => <span className="text-xs text-gray-500 break-all">{u.user.email}</span>,
            },
            {
              key: 'type',
              header: 'Account type',
              cell: (u) => <AdminStatusBadge status={u.accountType} label={ACCOUNT_TYPE_LABEL[u.accountType]} />,
            },
            {
              key: 'app',
              header: 'Driver application',
              cell: (u) => u.accountType === 'DRIVER_APPLICANT' ? (
                u.driverApplication
                  ? <AdminStatusBadge status={u.driverApplication.status} label={APP_STATUS_LABEL[u.driverApplication.status]} />
                  : <span className="text-xs text-gray-500">Not submitted</span>
              ) : <span className="text-gray-300">—</span>,
            },
            {
              key: 'wallet',
              header: 'Wallet',
              cell: (u) => <span className="text-xs font-medium tabular-nums">{formatWallet(u.wallet?.balanceSar)}</span>,
            },
            {
              key: 'activity',
              header: 'Activity',
              cell: (u) => (
                <span className="text-xs text-gray-500">{u._count.userSubscriptions} subs · {u._count.riders} riders</span>
              ),
            },
            {
              key: 'joined',
              header: 'Joined',
              cell: (u) => (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              cell: (u) => (
                <AdminRowMenu
                  items={[
                    { label: 'View details', onClick: () => setSelected(u) },
                    { label: 'Copy email', onClick: () => { void navigator.clipboard.writeText(u.user.email); } },
                    {
                      label: 'View subscriptions',
                      onClick: () => { window.location.href = `/admin?section=subscriptions&userId=${u.id}`; },
                      disabled: u._count.userSubscriptions === 0,
                    },
                    {
                      label: 'View riders',
                      onClick: () => { window.location.href = `/admin?section=riders&parentId=${u.id}`; },
                      disabled: u._count.riders === 0,
                    },
                    {
                      label: 'View driver application',
                      onClick: () => { window.location.href = '/admin?section=applications'; },
                      disabled: u.accountType !== 'DRIVER_APPLICANT',
                    },
                  ]}
                />
              ),
            },
          ]}
          mobileCard={(u) => (
            <AdminDataCard
              title={u.fullName}
              subtitle={u.user.email}
              badges={<AdminStatusBadge status={u.accountType} label={ACCOUNT_TYPE_LABEL[u.accountType]} />}
              onClick={() => setSelected(u)}
              metadata={
                <>
                  <AdminMetaItem label="Wallet" value={formatWallet(u.wallet?.balanceSar)} />
                  <AdminMetaItem label="Subs" value={u._count.userSubscriptions} />
                  <AdminMetaItem label="Riders" value={u._count.riders} />
                </>
              }
              compact
            />
          )}
        />
      )}

      <AdminPagination
        meta={meta}
        onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        className="mt-5"
      />

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.fullName ?? ''}
        subtitle={selected?.user.email}
        width="lg"
      >
        {detailLoading ? (
          <p className="text-sm text-gray-500 animate-pulse">Loading profile…</p>
        ) : selected && detail && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <AdminAvatar name={selected.fullName} />
              <AdminStatusBadge status={selected.accountType} label={ACCOUNT_TYPE_LABEL[selected.accountType]} />
            </div>

            <AdminDrawerSection title="Account">
              <AdminDrawerRow label="Account type" value={<AdminStatusBadge status={selected.accountType} label={ACCOUNT_TYPE_LABEL[selected.accountType]} />} />
              <AdminDrawerRow label="Display role" value={selected.displayRole} />
              <AdminDrawerRow label="Auth role" value={detail.role} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Profile">
              <AdminDrawerRow label="Email" value={detail.user.email} />
              <AdminDrawerRow label="Phone" value={detail.phone ?? '—'} />
              <AdminDrawerRow label="Wallet" value={formatWallet(detail.wallet?.balanceSar)} />
              <AdminDrawerRow label="Joined" value={new Date(detail.user.createdAt).toLocaleDateString()} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Subscriptions summary">
              {detail.userSubscriptions.length === 0 ? (
                <p className="text-sm text-gray-500">No subscriptions</p>
              ) : (
                detail.userSubscriptions.map((s) => (
                  <div key={s.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0">
                    <span className="capitalize">{s.subscriptionType.toLowerCase()}</span>
                    <div className="flex items-center gap-2">
                      <AdminStatusBadge status={s.paymentStatus} />
                      <AdminStatusBadge status={s.status} />
                    </div>
                  </div>
                ))
              )}
            </AdminDrawerSection>

            <AdminDrawerSection title="Riders summary">
              {detail.riders.length === 0 ? (
                <p className="text-sm text-gray-500">No riders</p>
              ) : (
                detail.riders.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                    <span>{r.name}</span>
                    <span className="text-gray-500 text-xs">{r.school ?? '—'}</span>
                  </div>
                ))
              )}
            </AdminDrawerSection>

            {selected.accountType === 'DRIVER_APPLICANT' && (
              <AdminDrawerSection title="Driver application summary">
                {selected.driverApplication ? (
                  <>
                    <AdminDrawerRow label="Status" value={<AdminStatusBadge status={selected.driverApplication.status} label={APP_STATUS_LABEL[selected.driverApplication.status]} />} />
                    <p className="text-xs text-gray-500">{APP_STATUS_HELPER[selected.driverApplication.status]}</p>
                    <a href="/admin?section=applications" className="text-xs text-fizza-secondary underline mt-2 inline-block min-h-[44px] flex items-center">View in applications</a>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">{APP_STATUS_HELPER.NOT_SUBMITTED}</p>
                )}
              </AdminDrawerSection>
            )}

            {detail.payments.length > 0 && (
              <AdminDrawerSection title="Recent payments / audit">
                {detail.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm py-1">
                    <span>{formatWallet(p.amountSar)}</span>
                    <AdminStatusBadge status={p.status} />
                  </div>
                ))}
              </AdminDrawerSection>
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
