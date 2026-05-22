'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminUserService } from '@/services/adminService';

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

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PARENT: { label: 'Parent', color: 'text-blue-700', bg: 'bg-blue-50' },
  DRIVER: { label: 'Driver', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  ADMIN: { label: 'Admin', color: 'text-red-700', bg: 'bg-red-50' },
  RIDER: { label: 'Rider', color: 'text-purple-700', bg: 'bg-purple-50' },
};

export function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

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
      <h2 className="text-lg font-semibold mb-4">Users</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          className="input text-sm flex-1 min-w-40"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input text-sm"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          {['PARENT', 'DRIVER', 'ADMIN'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading users…</div>
      ) : error ? (
        <div className="card text-red-600 text-sm">{error}</div>
      ) : users.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Wallet</th>
                <th className="pb-2 font-medium">Subs</th>
                <th className="pb-2 font-medium">Riders</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const rc = ROLE_CFG[u.role] ?? ROLE_CFG.PARENT;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-gray-800">{u.fullName}</p>
                      {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{u.user.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rc.bg} ${rc.color}`}>
                        {rc.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {u.wallet ? `SAR ${Number(u.wallet.balanceSar).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-center text-gray-600">{u._count.userSubscriptions}</td>
                    <td className="py-2.5 pr-4 text-center text-gray-600">{u._count.riders}</td>
                    <td className="py-2.5 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} users)</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}
