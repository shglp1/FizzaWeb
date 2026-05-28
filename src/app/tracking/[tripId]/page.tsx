'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DriverErrorState } from '@/components/driver/DriverUI';
import { ParentTrackingView } from '@/components/parent/tracking/ParentTrackingView';
import { ParentErrorState } from '@/components/parent/ParentUI';
import { DriverTrackingView } from '@/components/driver/DriverTrackingView';
import { useTripTracking } from '@/hooks/useTripTracking';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';

type RoleLoadState = 'loading' | 'ready' | 'error';

function TrackingPageLoading() {
  return (
    <div className="max-w-3xl mx-auto py-6" aria-busy="true" aria-label="Loading trip tracking">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-56 rounded-lg bg-gray-200" />
        <div className="h-5 w-40 rounded-md bg-gray-100" />
        <div className="h-[280px] sm:h-[420px] rounded-2xl bg-gray-200" />
        <div className="h-24 rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-32 rounded-2xl bg-gray-100" />
          <div className="h-32 rounded-2xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function TrackingDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [roleLoadState, setRoleLoadState] = useState<RoleLoadState>('loading');
  const [userRole, setUserRole] = useState<string>('PARENT');
  const tracking = useTripTracking(tripId);
  const copy = getParentTrackingCopy('en');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.data?.role) {
          setUserRole(res.data.role);
          setRoleLoadState('ready');
        } else {
          setRoleLoadState('error');
        }
      })
      .catch(() => {
        if (!cancelled) setRoleLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roleKnown = roleLoadState !== 'loading';
  const isDriver = userRole === 'DRIVER';

  if (!roleKnown || tracking.loading) {
    return (
      <AppShell>
        <TrackingPageLoading />
      </AppShell>
    );
  }

  if (tracking.pageError || !tracking.trip) {
    return (
      <AppShell>
        {isDriver ? (
          <DriverErrorState message={tracking.pageError || copy.notFound} onRetry={tracking.refresh} />
        ) : (
          <div className="max-w-3xl mx-auto">
            <ParentErrorState message={tracking.pageError || copy.notFound} onRetry={tracking.refresh} />
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      {isDriver ? (
        <DriverTrackingView tracking={tracking} userRole={userRole} />
      ) : (
        <ParentTrackingView tracking={tracking} userRole={userRole} />
      )}
    </AppShell>
  );
}
