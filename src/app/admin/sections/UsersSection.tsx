'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminUserService } from '@/services/adminService';
import { Card, Badge, Input, LoadingState, ErrorState, EmptyState, Pagination } from '@/components/ui';

type UserRow = {
  id: string;
  fullName: string;
  role: string;
  phone: string | null;
  createdAt: string;
  user: { email: string };
  wallet: { balanceSar: string } | null;
  _count: { userSubscriptions: number; riders: number };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

const ROLE_VARIANT: Record<string, 'info' | 'purple' | 'danger' | 'orange'> = {
  PARENT: 'info',
  DRIVER: 'purple',
  ADMIN:  'danger',
  RIDER:  'orange',
};

export function UsersSection() {
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [meta, setMeta]     = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage]     = useState(1);

  const load = useCallback((s: string, r: string, p: number) => {
    setLoading(true);
    setError('');
    adminUserService.list({ search: s || undefined, role: r || undefined, page: p }).then((res) => {
      if (res.data) {
        setUsers((res.data as { users: UserRow[]; meta: Meta }).users ?? []);
        setMeta((res.data as { users: UserRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load users.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(search, roleFilter, page); }, [search, roleFilter, page, load]);

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Users
        {meta && <span className="ml-2 text-sm font-normal text-gray-400">({meta.total} total)</span>}
      </h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-52">
          <Input
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input text-sm h-10 min-w-36"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          {['PARENT', 'DRIVER', 'ADMIN'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingState message="Loading users…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search, roleFilter, page)} />
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
                  <th className="pb-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
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
                      <Badge variant={ROLE_VARIANT[u.role] ?? 'info'} className="text-[10px]">{u.role}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 text-xs">
                      {u.wallet ? `SAR ${Number(u.wallet.balanceSar).toFixed(2)}` : <span className="text-gray-300">—</span>}
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
