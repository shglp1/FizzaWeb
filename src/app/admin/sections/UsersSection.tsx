'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminUserService } from '@/services/adminService';
import { Card, Badge, Input, LoadingState, ErrorState, EmptyState, Pagination } from '@/components/ui';
import type { AccountType } from '@/lib/adminUserTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

type DriverApp = {
  id: string;
  status: string;
  adminResponse: string | null;
  updatedAt: string;
  createdAt: string;
} | null;

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

type Meta    = { page: number; limit: number; total: number; totalPages: number };
type Summary = { admins: number; approvedDrivers: number; driverApplicants: number; familyParents: number };

// ─── Badge variants ───────────────────────────────────────────────────────────

const ACCOUNT_TYPE_VARIANT: Record<AccountType, 'info' | 'success' | 'warning' | 'danger'> = {
  FAMILY_PARENT:    'info',
  DRIVER_APPLICANT: 'warning',
  APPROVED_DRIVER:  'success',
  ADMIN:            'danger',
};

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  FAMILY_PARENT:    'Parent',
  DRIVER_APPLICANT: 'Driver Applicant',
  APPROVED_DRIVER:  'Driver',
  ADMIN:            'Admin',
};

const APP_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'orange' | 'gray'> = {
  PENDING:       'warning',
  APPROVED:      'success',
  REJECTED:      'danger',
  NEEDS_CHANGES: 'orange',
};

const APP_STATUS_LABEL: Record<string, string> = {
  PENDING:       'Pending review',
  APPROVED:      'Approved',
  REJECTED:      'Rejected',
  NEEDS_CHANGES: 'Needs changes',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${color}`}>
      <span className="text-2xl font-bold leading-none">{value}</span>
      <span className="text-xs text-current opacity-70">{label}</span>
    </div>
  );
}

function AppStatusCell({ user }: { user: UserRow }) {
  if (user.accountType === 'FAMILY_PARENT' || user.accountType === 'ADMIN' || user.accountType === 'APPROVED_DRIVER') {
    return <span className="text-gray-300">—</span>;
  }
  // Driver applicant
  if (!user.driverApplication) {
    return (
      <span className="text-xs text-gray-400">
        {user.registrationSource === 'DRIVER_PORTAL' ? 'Not submitted' : '—'}
      </span>
    );
  }
  const s = user.driverApplication.status;
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={APP_STATUS_VARIANT[s] ?? 'gray'} className="text-[10px]">
        {APP_STATUS_LABEL[s] ?? s}
      </Badge>
      <a
        href="/admin?section=applications"
        className="text-[10px] text-fizza-secondary hover:underline"
      >
        View →
      </a>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UsersSection() {
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [meta, setMeta]       = useState<Meta | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter]     = useState('');
  const [page, setPage]       = useState(1);

  const load = useCallback((s: string, at: string, as_: string, p: number) => {
    setLoading(true);
    setError('');
    adminUserService.list({
      search:            s || undefined,
      accountType:       at || undefined,
      applicationStatus: as_ || undefined,
      page:              p,
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

  useEffect(() => {
    load(search, accountTypeFilter, appStatusFilter, page);
  }, [search, accountTypeFilter, appStatusFilter, page, load]);

  // Reset app status filter when switching away from DRIVER_APPLICANT
  const handleAccountTypeChange = (v: string) => {
    setAccountTypeFilter(v);
    if (v !== 'DRIVER_APPLICANT') setAppStatusFilter('');
    setPage(1);
  };

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Users
        {meta && <span className="ml-2 text-sm font-normal text-gray-400">({meta.total} total)</span>}
      </h2>

      {/* KPI summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            label="Parents"
            value={summary.familyParents}
            color="border-blue-100 bg-blue-50 text-blue-700"
          />
          <SummaryCard
            label="Driver Applicants"
            value={summary.driverApplicants}
            color="border-amber-100 bg-amber-50 text-amber-700"
          />
          <SummaryCard
            label="Drivers"
            value={summary.approvedDrivers}
            color="border-emerald-100 bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            label="Admins"
            value={summary.admins}
            color="border-red-100 bg-red-50 text-red-700"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-52">
          <Input
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Account type filter */}
        <select
          className="input text-sm h-10 min-w-44"
          value={accountTypeFilter}
          onChange={(e) => handleAccountTypeChange(e.target.value)}
        >
          <option value="">All Accounts</option>
          <option value="FAMILY_PARENT">Parents</option>
          <option value="DRIVER_APPLICANT">Driver Applicants</option>
          <option value="APPROVED_DRIVER">Approved Drivers</option>
          <option value="ADMIN">Admins</option>
        </select>

        {/* Application status filter — visible only for DRIVER_APPLICANT */}
        {accountTypeFilter === 'DRIVER_APPLICANT' && (
          <select
            className="input text-sm h-10 min-w-44"
            value={appStatusFilter}
            onChange={(e) => { setAppStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="NOT_SUBMITTED">Not Submitted</option>
            <option value="PENDING">Pending Review</option>
            <option value="NEEDS_CHANGES">Needs Changes</option>
            <option value="REJECTED">Rejected</option>
            <option value="APPROVED">Approved (Sync Pending)</option>
          </select>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading users…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search, accountTypeFilter, appStatusFilter, page)} />
      ) : users.length === 0 ? (
        <EmptyState icon="👤" title="No users found" description="Try adjusting your search or filter." />
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Type</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Driver Application</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Wallet</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Subs</th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Riders</th>
                  <th className="pb-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{u.fullName}</p>
                      {u.phone && <p className="text-xs text-gray-400 mt-0.5">{u.phone}</p>}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 text-xs">{u.user.email}</td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={ACCOUNT_TYPE_VARIANT[u.accountType] ?? 'info'}
                        className="text-[10px]"
                      >
                        {ACCOUNT_TYPE_LABEL[u.accountType] ?? u.accountType}
                      </Badge>
                      {/* Show sub-status label for driver applicants */}
                      {u.accountType === 'DRIVER_APPLICANT' && (
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight max-w-[140px]">
                          {u.driverApplication
                            ? APP_STATUS_LABEL[u.driverApplication.status] ?? u.driverApplication.status
                            : 'Not submitted'}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <AppStatusCell user={u} />
                    </td>
                    <td className="py-3 pr-4 text-gray-600 text-xs">
                      {u.wallet
                        ? `SAR ${Number(u.wallet.balanceSar).toFixed(2)}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600 text-sm">{u._count.userSubscriptions}</td>
                    <td className="py-3 pr-4 text-center text-gray-600 text-sm">{u._count.riders}</td>
                    <td className="py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          className="mt-5"
        />
      )}
    </>
  );
}
