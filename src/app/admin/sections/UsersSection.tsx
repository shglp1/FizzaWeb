'use client';

import { UserRound } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { adminUserService } from '@/services/adminService';
import { Card, Badge, Pagination } from '@/components/ui';
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

// ─── Badge / label mappings ───────────────────────────────────────────────────

export const ACCOUNT_TYPE_VARIANT: Record<AccountType, 'info' | 'success' | 'warning' | 'purple'> = {
  FAMILY_PARENT:    'info',
  DRIVER_APPLICANT: 'warning',
  APPROVED_DRIVER:  'success',
  ADMIN:            'purple',
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  FAMILY_PARENT:    'Parent',
  DRIVER_APPLICANT: 'Driver Applicant',
  APPROVED_DRIVER:  'Approved Driver',
  ADMIN:            'Admin',
};

export const APP_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'orange' | 'gray'> = {
  PENDING:       'warning',
  APPROVED:      'success',
  REJECTED:      'danger',
  NEEDS_CHANGES: 'orange',
};

export const APP_STATUS_LABEL: Record<string, string> = {
  PENDING:       'Pending review',
  APPROVED:      'Approved',
  REJECTED:      'Rejected',
  NEEDS_CHANGES: 'Needs changes',
};

// For filter-chip display (includes NOT_SUBMITTED)
export const APP_STATUS_FILTER_LABEL: Record<string, string> = {
  NOT_SUBMITTED: 'Not Submitted',
  PENDING:       'Pending Review',
  NEEDS_CHANGES: 'Needs Changes',
  REJECTED:      'Rejected',
  APPROVED:      'Approved (Sync Pending)',
};

// Helper text shown to admin below each application status
export const APP_STATUS_HELPER: Record<string, string> = {
  NOT_SUBMITTED: 'Registered through driver portal but application form not submitted yet.',
  PENDING:       'Application submitted and waiting for admin review.',
  NEEDS_CHANGES: 'Admin requested updates to the application.',
  REJECTED:      'Application was rejected.',
  APPROVED:      'Application approved — user session/role may need refresh.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatWallet(balance: string | null | undefined): string {
  if (balance == null || balance === '') return '—';
  const n = Number(balance);
  return isNaN(n) ? '—' : `SAR ${n.toFixed(2)}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || '??').toUpperCase();
}

const AVATAR_PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-purple-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ─── Summary card config ──────────────────────────────────────────────────────

type SummaryCfg = {
  key: keyof Summary;
  accountType: AccountType;
  label: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
  iconBg: string;
  icon: React.ReactNode;
};

const SUMMARY_CONFIG: SummaryCfg[] = [
  {
    key:         'familyParents',
    accountType: 'FAMILY_PARENT',
    label:       'Parents',
    ringColor:   'ring-blue-400',
    bgColor:     'bg-blue-50 border-blue-100',
    textColor:   'text-blue-700',
    iconBg:      'bg-blue-100 text-blue-600',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key:         'driverApplicants',
    accountType: 'DRIVER_APPLICANT',
    label:       'Driver Applicants',
    ringColor:   'ring-amber-400',
    bgColor:     'bg-amber-50 border-amber-100',
    textColor:   'text-amber-700',
    iconBg:      'bg-amber-100 text-amber-600',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    key:         'approvedDrivers',
    accountType: 'APPROVED_DRIVER',
    label:       'Approved Drivers',
    ringColor:   'ring-emerald-400',
    bgColor:     'bg-emerald-50 border-emerald-100',
    textColor:   'text-emerald-700',
    iconBg:      'bg-emerald-100 text-emerald-600',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    key:         'admins',
    accountType: 'ADMIN',
    label:       'Admins',
    ringColor:   'ring-purple-400',
    bgColor:     'bg-purple-50 border-purple-100',
    textColor:   'text-purple-700',
    iconBg:      'bg-purple-100 text-purple-600',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
];

// ─── Skeleton components ──────────────────────────────────────────────────────

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

function SkeletonSummaryCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 flex gap-3 items-start">
      <SkeletonPulse className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <SkeletonPulse className="h-6 w-10" />
        <SkeletonPulse className="h-3 w-24" />
      </div>
    </div>
  );
}

function SkeletonTableRow() {
  const widths = ['w-36', 'w-28', 'w-24', 'w-28', 'w-16', 'w-20', 'w-20', 'w-16'];
  return (
    <tr>
      {widths.map((w, i) => (
        <td key={i} className="py-4 pr-4">
          <SkeletonPulse className={`h-4 ${w}`} />
        </td>
      ))}
    </tr>
  );
}

// ─── Icon components ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function CloseIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  cfg,
  count,
  isActive,
  onClick,
}: {
  cfg: SummaryCfg;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={`${isActive ? 'Remove filter' : 'Filter by'} ${cfg.label}`}
      className={`w-full text-left rounded-2xl border p-4 flex gap-3 items-start transition-all
        ${cfg.bgColor} ${cfg.textColor}
        ${isActive ? `ring-2 ${cfg.ringColor} ring-opacity-60 shadow-md` : 'hover:shadow-sm hover:brightness-[0.97]'}
      `}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
        {cfg.icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none tabular-nums">{count}</p>
        <p className="text-xs mt-1 opacity-70 leading-tight font-medium">{cfg.label}</p>
      </div>
      {isActive && (
        <span className="ml-auto text-[10px] font-semibold opacity-60 self-start pt-1">✕ active</span>
      )}
    </button>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-fizza-secondary/10 text-fizza-primary border border-fizza-secondary/20 text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-fizza-secondary transition-colors"
        aria-label={`Remove "${label}" filter`}
      >
        <CloseIcon size={10} />
      </button>
    </span>
  );
}

// ─── User avatar ──────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  return (
    <div
      className={`w-8 h-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-[11px] font-bold shrink-0 select-none`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Driver application status cell ──────────────────────────────────────────

function AppStatusCell({ user }: { user: UserRow }) {
  if (user.accountType !== 'DRIVER_APPLICANT') {
    return <span className="text-gray-300">—</span>;
  }
  const app = user.driverApplication;
  const helperKey = app ? app.status : 'NOT_SUBMITTED';
  return (
    <div className="space-y-0.5">
      {app ? (
        <Badge variant={APP_STATUS_VARIANT[app.status] ?? 'gray'} className="text-[10px]">
          {APP_STATUS_LABEL[app.status] ?? app.status}
        </Badge>
      ) : (
        <span className="text-[11px] font-medium text-gray-500">Not submitted</span>
      )}
      {APP_STATUS_HELPER[helperKey] && (
        <p className="text-[10px] text-gray-400 leading-tight max-w-[170px]">
          {APP_STATUS_HELPER[helperKey]}
        </p>
      )}
      <a
        href="/admin?section=applications"
        className="text-[10px] text-fizza-secondary hover:underline inline-flex items-center gap-0.5 mt-0.5"
        aria-label={`View driver application for ${user.fullName}`}
      >
        View application →
      </a>
    </div>
  );
}

// ─── Copy email action ────────────────────────────────────────────────────────

function CopyEmailButton({ email, name }: { email: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      type="button"
      onClick={copyEmail}
      title={copied ? 'Copied!' : `Copy ${email}`}
      aria-label={copied ? 'Email address copied' : `Copy email for ${name}`}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

// ─── Mobile user card ─────────────────────────────────────────────────────────

function UserMobileCard({ user }: { user: UserRow }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3 shadow-sm">
      {/* Header: avatar + name + badge */}
      <div className="flex items-start gap-3">
        <UserAvatar name={user.fullName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{user.fullName}</p>
            <Badge variant={ACCOUNT_TYPE_VARIANT[user.accountType] ?? 'info'} className="text-[10px] shrink-0">
              {ACCOUNT_TYPE_LABEL[user.accountType] ?? user.accountType}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{user.user.email}</p>
          {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
        </div>
      </div>

      {/* Driver application status — driver applicants only */}
      {user.accountType === 'DRIVER_APPLICANT' && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            {user.driverApplication ? (
              <Badge variant={APP_STATUS_VARIANT[user.driverApplication.status] ?? 'gray'} className="text-[10px]">
                {APP_STATUS_LABEL[user.driverApplication.status] ?? user.driverApplication.status}
              </Badge>
            ) : (
              <span className="text-[11px] font-semibold text-amber-700">Not submitted</span>
            )}
            <a href="/admin?section=applications" className="text-[10px] text-amber-700 underline shrink-0">
              View →
            </a>
          </div>
          <p className="text-[10px] text-amber-600 leading-tight">
            {APP_STATUS_HELPER[user.driverApplication ? user.driverApplication.status : 'NOT_SUBMITTED']}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>
          Wallet:{' '}
          <span className="font-medium text-gray-700">{formatWallet(user.wallet?.balanceSar)}</span>
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
          {user._count.userSubscriptions} subs
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
          {user._count.riders} riders
        </span>
      </div>

      {/* Footer: joined + action */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
        <span>Joined {new Date(user.createdAt).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <CopyEmailButton email={user.user.email} name={user.fullName} />
      </div>
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

  // Search with debounce
  const [searchInput, setSearchInput]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter]     = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search input (350 ms)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

  const load = useCallback((s: string, at: string, as_: string, p: number) => {
    setLoading(true);
    setError('');
    adminUserService
      .list({
        search:            s || undefined,
        accountType:       at || undefined,
        applicationStatus: as_ || undefined,
        page:              p,
      })
      .then((res) => {
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
    load(debouncedSearch, accountTypeFilter, appStatusFilter, page);
  }, [debouncedSearch, accountTypeFilter, appStatusFilter, page, load]);

  // ── Filter helpers ──────────────────────────────────────────────────────────

  const handleSummaryClick = (at: AccountType) => {
    const next = accountTypeFilter === at ? '' : at;
    setAccountTypeFilter(next);
    if (next !== 'DRIVER_APPLICANT') setAppStatusFilter('');
    setPage(1);
  };

  const handleAccountTypeChange = (v: string) => {
    setAccountTypeFilter(v);
    if (v !== 'DRIVER_APPLICANT') setAppStatusFilter('');
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setAccountTypeFilter('');
    setAppStatusFilter('');
    setPage(1);
  };

  const hasFilters = !!(debouncedSearch || accountTypeFilter || appStatusFilter);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage family accounts, driver applicants, approved drivers, and admins.
          </p>
        </div>
        {meta && (
          <span className="text-sm text-gray-400 shrink-0 self-start mt-1">
            {meta.total.toLocaleString()} {meta.total === 1 ? 'user' : 'users'} total
          </span>
        )}
      </div>

      {/* Info note */}
      <div className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5 inline-flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          Driver applicants remain{' '}
          <code className="font-mono text-gray-500 bg-gray-100 px-1 rounded">PARENT</code>
          {' '}in auth until admin approval, but are shown separately here.
        </span>
      </div>

      {/* ── KPI Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading && !summary
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonSummaryCard key={i} />)
          : SUMMARY_CONFIG.map((cfg) => (
              <SummaryCard
                key={cfg.key}
                cfg={cfg}
                count={summary?.[cfg.key] ?? 0}
                isActive={accountTypeFilter === cfg.accountType}
                onClick={() => handleSummaryClick(cfg.accountType)}
              />
            ))
        }
      </div>

      {/* ── Search & filters ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-start">

          {/* Search input */}
          <div className="flex-1 min-w-60">
            <label htmlFor="users-search" className="sr-only">Search users</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon />
              </span>
              <input
                id="users-search"
                type="search"
                className="input pl-9 pr-9 text-sm h-10 w-full"
                placeholder="Search by name, email, or phone…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search users by name, email, or phone"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Account type filter */}
          <div>
            <label htmlFor="account-type-filter" className="sr-only">Filter by account type</label>
            <select
              id="account-type-filter"
              className="input text-sm h-10 min-w-44 cursor-pointer"
              value={accountTypeFilter}
              onChange={(e) => handleAccountTypeChange(e.target.value)}
              aria-label="Filter users by account type"
            >
              <option value="">All Accounts</option>
              <option value="FAMILY_PARENT">Parents</option>
              <option value="DRIVER_APPLICANT">Driver Applicants</option>
              <option value="APPROVED_DRIVER">Approved Drivers</option>
              <option value="ADMIN">Admins</option>
            </select>
          </div>

          {/* Application status filter — visible only for Driver Applicants */}
          {accountTypeFilter === 'DRIVER_APPLICANT' && (
            <div>
              <label htmlFor="app-status-filter" className="sr-only">Filter by application status</label>
              <select
                id="app-status-filter"
                className="input text-sm h-10 min-w-44 cursor-pointer"
                value={appStatusFilter}
                onChange={(e) => { setAppStatusFilter(e.target.value); setPage(1); }}
                aria-label="Filter driver applicants by application status"
              >
                <option value="">All Statuses</option>
                <option value="NOT_SUBMITTED">Not Submitted</option>
                <option value="PENDING">Pending Review</option>
                <option value="NEEDS_CHANGES">Needs Changes</option>
                <option value="REJECTED">Rejected</option>
                <option value="APPROVED">Approved (Sync Pending)</option>
              </select>
            </div>
          )}

          {/* Reset filters */}
          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="h-10 px-4 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors whitespace-nowrap"
              aria-label="Reset all filters"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Active:</span>
            {debouncedSearch && (
              <FilterChip
                label={`"${debouncedSearch}"`}
                onRemove={() => { setSearchInput(''); setDebouncedSearch(''); setPage(1); }}
              />
            )}
            {accountTypeFilter && (
              <FilterChip
                label={ACCOUNT_TYPE_LABEL[accountTypeFilter as AccountType] ?? accountTypeFilter}
                onRemove={() => { setAccountTypeFilter(''); setAppStatusFilter(''); setPage(1); }}
              />
            )}
            {appStatusFilter && (
              <FilterChip
                label={APP_STATUS_FILTER_LABEL[appStatusFilter] ?? appStatusFilter}
                onRemove={() => { setAppStatusFilter(''); setPage(1); }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Table / empty / error ─────────────────────────────────────────────── */}
      {loading ? (
        /* Skeleton table */
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  {['User', 'Email', 'Account Type', 'Driver Application', 'Wallet', 'Activity', 'Joined', 'Actions'].map((h) => (
                    <th key={h} scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)}
              </tbody>
            </table>
          </div>
        </Card>
      ) : error ? (
        /* Error state */
        <div className="rounded-2xl border border-red-100 bg-red-50 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="font-semibold text-red-800 mb-1">Failed to load users</p>
          <p className="text-sm text-red-500 mb-5">{error}</p>
          <button
            type="button"
            onClick={() => load(debouncedSearch, accountTypeFilter, appStatusFilter, page)}
            className="btn-secondary btn-sm"
          >
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-gray-100 bg-white p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mx-auto mb-4" aria-hidden="true">
            <UserRound className="h-8 w-8 text-gray-400" strokeWidth={1.75} aria-hidden />
          </div>
          <p className="font-semibold text-gray-700 mb-1.5">
            {hasFilters ? 'No users match your filters' : 'No users yet'}
          </p>
          <p className="text-sm text-gray-400 mb-5">
            {hasFilters ? 'Try adjusting or removing your filters.' : 'Users will appear here once accounts are created.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary btn-sm"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Desktop table ─────────────────────────────────────────────────── */}
          <div className="hidden sm:block">
            <Card padding="sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Type</th>
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Driver Application</th>
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Wallet</th>
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity</th>
                      <th scope="col" className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                      <th scope="col" className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">

                        {/* User — avatar + name + phone */}
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar name={u.fullName} />
                            <div>
                              <p className="font-semibold text-gray-900 text-sm leading-tight">{u.fullName}</p>
                              {u.phone && (
                                <p className="text-[11px] text-gray-400 mt-0.5">{u.phone}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-4 pr-4 max-w-[180px]">
                          <span className="text-xs text-gray-500 break-all">{u.user.email}</span>
                        </td>

                        {/* Account Type */}
                        <td className="py-4 pr-4">
                          <Badge
                            variant={ACCOUNT_TYPE_VARIANT[u.accountType] ?? 'info'}
                            className="text-[10px]"
                          >
                            {ACCOUNT_TYPE_LABEL[u.accountType] ?? u.accountType}
                          </Badge>
                        </td>

                        {/* Driver Application */}
                        <td className="py-4 pr-4">
                          <AppStatusCell user={u} />
                        </td>

                        {/* Wallet */}
                        <td className="py-4 pr-4">
                          <span className="text-xs text-gray-700 font-medium tabular-nums">
                            {formatWallet(u.wallet?.balanceSar)}
                          </span>
                        </td>

                        {/* Activity — subs + riders */}
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium whitespace-nowrap">
                              {u._count.userSubscriptions} subs
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium whitespace-nowrap">
                              {u._count.riders} riders
                            </span>
                          </div>
                        </td>

                        {/* Joined */}
                        <td className="py-4 pr-4">
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString('en-SA', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4">
                          <div className="flex items-center gap-1">
                            <CopyEmailButton email={u.user.email} name={u.fullName} />
                            {u.accountType === 'DRIVER_APPLICANT' && (
                              <a
                                href="/admin?section=applications"
                                title={`View driver application for ${u.fullName}`}
                                aria-label={`View driver application for ${u.fullName}`}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <line x1="16" y1="13" x2="8" y2="13"/>
                                  <line x1="16" y1="17" x2="8" y2="17"/>
                                  <polyline points="10 9 9 9 8 9"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* ── Mobile cards ──────────────────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => <UserMobileCard key={u.id} user={u} />)}
          </div>
        </>
      )}

      {/* ── Pagination ────────────────────────────────────────────────────────── */}
      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}
    </div>
  );
}
