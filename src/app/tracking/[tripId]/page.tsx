'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DriverErrorState, DriverLoadingState } from '@/components/driver/DriverUI';
import { ParentTrackingView } from '@/components/parent/tracking/ParentTrackingView';
import { ParentTrackingLoading } from '@/components/parent/tracking/ParentTrackingSkeleton';
import { ParentErrorState } from '@/components/parent/ParentUI';
import { DriverTrackingView } from '@/components/driver/DriverTrackingView';
import { useTripTracking } from '@/hooks/useTripTracking';
import { getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';

export default function TrackingDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [userRole, setUserRole] = useState<string | null>(null);
  const tracking = useTripTracking(tripId);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.role) setUserRole(res.data.role);
      })
      .catch(() => {});
  }, []);

  const isDriver = userRole === 'DRIVER';
  const copy = getParentTrackingCopy('en');

  if (tracking.loading) {
    return (
      <AppShell>
        {isDriver ? (
          <DriverLoadingState message="Loading trip tracking…" />
        ) : (
          <div className="max-w-3xl mx-auto">
            <ParentTrackingLoading message={copy.loading} />
          </div>
        )}
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
        <DriverTrackingView tracking={tracking} userRole={userRole ?? 'DRIVER'} />
      ) : (
        <ParentTrackingView tracking={tracking} userRole={userRole ?? 'PARENT'} />
      )}
    </AppShell>
  );
}
