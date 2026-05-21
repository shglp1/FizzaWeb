'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AppShell } from '@/components/layout/AppShell';
import { riderService } from '@/services/riderService';

type Rider = {
  id: string;
  name: string;
  relationship: string;
  school: string | null;
  grade: string | null;
  phone: string | null;
  specialNeeds: boolean;
  notes: string | null;
  isActive: boolean;
};

type RiderFormValues = {
  name: string;
  relationship: string;
  school: string;
  grade: string;
  phone: string;
  specialNeeds: boolean;
  notes: string;
};

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RiderFormValues>();

  const loadRiders = () => {
    setLoading(true);
    riderService.list().then((res) => {
      if (res.data) setRiders(res.data);
      else setPageError(res.error?.message ?? 'Failed to load riders.');
      setLoading(false);
    });
  };

  useEffect(() => { loadRiders(); }, []);

  const openAdd = () => {
    setEditingRider(null);
    reset({ name: '', relationship: '', school: '', grade: '', phone: '', specialNeeds: false, notes: '' });
    setActionError('');
    setActionSuccess('');
    setShowForm(true);
  };

  const openEdit = (rider: Rider) => {
    setEditingRider(rider);
    reset({
      name: rider.name,
      relationship: rider.relationship,
      school: rider.school ?? '',
      grade: rider.grade ?? '',
      phone: rider.phone ?? '',
      specialNeeds: rider.specialNeeds,
      notes: rider.notes ?? '',
    });
    setActionError('');
    setActionSuccess('');
    setShowForm(true);
  };

  const onSubmit = async (values: RiderFormValues) => {
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const payload = {
        name: values.name,
        relationship: values.relationship,
        school: values.school || undefined,
        grade: values.grade || undefined,
        phone: values.phone || undefined,
        specialNeeds: values.specialNeeds,
        notes: values.notes || undefined,
      };

      const res = editingRider
        ? await riderService.update(editingRider.id, payload)
        : await riderService.create(payload);

      if (res.data) {
        setActionSuccess(editingRider ? 'Rider updated.' : 'Rider added.');
        setShowForm(false);
        loadRiders();
      } else {
        setActionError(res.error?.message ?? 'Failed to save rider.');
      }
    } catch {
      setActionError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (rider: Rider) => {
    setActionError('');
    setActionSuccess('');
    try {
      const res = rider.isActive
        ? await riderService.deactivate(rider.id)
        : await riderService.reactivate(rider.id);
      if (res.data) {
        setActionSuccess(`${rider.name} ${rider.isActive ? 'deactivated' : 'reactivated'}.`);
        loadRiders();
      } else {
        setActionError(res.error?.message ?? 'Action failed.');
      }
    } catch {
      setActionError('Something went wrong.');
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Family Riders</h1>
        <button className="btn-primary text-sm" onClick={openAdd}>+ Add Rider</button>
      </div>

      {actionSuccess && (
        <p className="text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 text-sm mb-4">
          {actionSuccess}
        </p>
      )}
      {actionError && (
        <p className="text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm mb-4">{actionError}</p>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="card mb-6 border-emerald-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editingRider ? 'Edit Rider' : 'Add Rider'}</h2>
            <button
              className="text-gray-400 hover:text-gray-600 text-sm"
              onClick={() => setShowForm(false)}
            >
              ✕ Cancel
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-3">
            <div>
              <input
                className="input"
                placeholder="Full Name *"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <input
                className="input"
                placeholder="Relationship (e.g. Son, Daughter) *"
                {...register('relationship', { required: 'Relationship is required' })}
              />
              {errors.relationship && (
                <p className="text-red-500 text-xs mt-1">{errors.relationship.message}</p>
              )}
            </div>
            <input className="input" placeholder="School" {...register('school')} />
            <input className="input" placeholder="Grade" {...register('grade')} />
            <input className="input" placeholder="Phone" {...register('phone')} />
            <label className="flex items-center gap-2 px-3 py-3 border border-emerald-200 rounded-xl cursor-pointer">
              <input type="checkbox" {...register('specialNeeds')} className="w-4 h-4" />
              <span className="text-sm">Has special needs</span>
            </label>
            <textarea
              className="input md:col-span-2 h-20 resize-none"
              placeholder="Notes (optional)"
              {...register('notes')}
            />
            <button
              type="submit"
              className="btn-primary md:col-span-2"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editingRider ? 'Update Rider' : 'Add Rider'}
            </button>
          </form>
        </div>
      )}

      {/* Riders list */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading riders…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : riders.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No riders yet</p>
          <p className="text-gray-400 text-sm mb-4">
            Add a family member to manage their school transport.
          </p>
          <button className="btn-primary" onClick={openAdd}>+ Add Your First Rider</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {riders.map((rider) => (
            <div
              key={rider.id}
              className={`card ${!rider.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-base">{rider.name}</h3>
                  <p className="text-sm text-gray-500">{rider.relationship}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    rider.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {rider.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1 mb-3">
                {rider.school && (
                  <p>🏫 {rider.school}{rider.grade ? ` · Grade ${rider.grade}` : ''}</p>
                )}
                {rider.phone && <p>📱 {rider.phone}</p>}
                {rider.specialNeeds && (
                  <p className="text-amber-600 font-medium">⚠ Special needs</p>
                )}
                {rider.notes && <p className="text-gray-400 italic">{rider.notes}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-outline text-sm flex-1 py-2"
                  onClick={() => openEdit(rider)}
                >
                  Edit
                </button>
                <button
                  className={`text-sm flex-1 py-2 rounded-xl font-semibold border ${
                    rider.isActive
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
                  onClick={() => toggleActive(rider)}
                >
                  {rider.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
